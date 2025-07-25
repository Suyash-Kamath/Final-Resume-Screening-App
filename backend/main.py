from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List
import pdfplumber
import docx
import tempfile
import os
import re
from openai import OpenAI
from dotenv import load_dotenv
import motor.motor_asyncio
from datetime import datetime, timedelta
from passlib.context import CryptContext
import jwt

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://final-resume-screening-app-4drk.onrender.com",
        "https://final-resume-screening-app.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB setup
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = mongo_client["resume_screening"]
mis_collection = db["mis"]
recruiters_collection = db["recruiters"]

# JWT setup
SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# Make sure to set OPENAI_API_KEY in your .env file
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# --- Recruiter Auth Helpers ---
def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def get_password_hash(password):
    return pwd_context.hash(password)

async def get_recruiter(username: str):
    return await recruiters_collection.find_one({"username": username})

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_recruiter(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    recruiter = await get_recruiter(username)
    if recruiter is None:
        raise credentials_exception
    return recruiter

# --- Auth Endpoints ---
@app.post("/register")
async def register(form: OAuth2PasswordRequestForm = Depends()):
    existing = await recruiters_collection.find_one({"username": form.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed = get_password_hash(form.password)
    await recruiters_collection.insert_one({"username": form.username, "hashed_password": hashed})
    return {"msg": "Recruiter registered"}

@app.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    recruiter = await recruiters_collection.find_one({"username": form.username})
    if not recruiter or not verify_password(form.password, recruiter["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": recruiter["username"]})
    return {"access_token": access_token, "token_type": "bearer", "recruiter_name": recruiter["username"]}

def extract_text_from_pdf(filepath):
    with pdfplumber.open(filepath) as pdf:
        return '\n'.join(page.extract_text() for page in pdf.pages if page.extract_text())

from docx import Document

def extract_text_from_docx(filepath: str) -> str:
    """
    Enhanced DOCX extractor for Naukri resumes and other structured documents.
    Tries structured paragraph and table parsing first, then falls back to docx2txt.
    """
    try:
        from docx import Document
        import docx2txt

        full_text = []

        # Primary extraction using python-docx
        doc = Document(filepath)

        # Extract paragraphs
        for para in doc.paragraphs:
            line = para.text.strip()
            if line and line not in full_text:
                full_text.append(line)

        # Extract from tables
        for table in doc.tables:
            for row in table.rows:
                row_data = []
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text and cell_text not in row_data:
                        row_data.append(cell_text)
                if row_data:
                    full_text.append(" | ".join(row_data))

        # Fallback to docx2txt if primary fails
        if not full_text or len("".join(full_text).strip()) < 30:
            fallback_text = docx2txt.process(filepath)
            if fallback_text and fallback_text.strip():
                full_text = [line.strip() for line in fallback_text.splitlines() if line.strip()]

        # Final cleanup: remove exact duplicates while preserving order
        final_text = "\n".join(dict.fromkeys(full_text))
        return final_text.strip() if final_text else "❌ Could not extract usable text from this resume."

    except Exception as e:
        return f"❌ Error extracting text from DOCX: {e}"




def analyze_resume(jd, resume_text, hiring_choice, level_choice):
    prompt = ""
    if hiring_choice == "1":
        if level_choice == "1":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Sales Fresher** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: 
   - Candidate must be either from the job location city (e.g., Kolkata) or nearby cities (e.g., Durgapur) within feasible travel distance.
   - If candidate is not in the exact city but lives in a nearby town and the job allows remote or field sales operations, they should be considered.
   - Candidate should be able to travel to the main office once a month for reporting.
2. Age: As per job description.
3. Education: 12th pass & above.
4. Gender: As per job description.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
        elif level_choice == "2":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Sales Experienced** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: 
   - Candidate must be either from the job location city (e.g., Kolkata) or nearby cities (e.g., Durgapur) within feasible travel distance.
   - If candidate is not in the exact city but lives in a nearby town and the job allows remote or field sales operations, they should be considered.
   - Candidate should be able to travel to the main office once a month for reporting.
2. Age: As per job description ("up to" logic preferred).
3. Total Experience: Add all types of sales (health + motor, etc.).
4. Relevant Experience: Must match industry (strict).
5. Education: 12th pass & above accepted.
6. Gender: As per job description.
7. Skills: Skills should align with relevant experience.
8. Stability: Ignore if 1 job <1 year; Reject if 2+ jobs each <1 year.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
    elif hiring_choice == "2":
        if level_choice == "1":
            prompt = f"""
You are a professional HR assistant AI screening resumes for an **IT Fresher** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must be local.
2. Age: Ignore or as per JD.
3. Experience: Internship is a bonus; no experience is fine.
4. Projects: Highlighted as experience if relevant.
5. Education: B.E, M.E, BTech, MTech, or equivalent in IT.
6. Gender: As per job description.
7. Skills: Must align with the job field (e.g., Full Stack).
Note: For example, if hiring for a Full Stack Engineer role, even if one or two skills mentioned in the Job Description are missing, the candidate can still be considered if they have successfully built Full Stack projects. Additional skills or tools mentioned in the JD are good-to-have, but not mandatory.
8. Stability: Not applicable.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
        elif level_choice == "2":
            prompt = f"""
You are a professional HR assistant AI screening resumes for an **IT Experienced** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must be local.
2. Age: As per job description (prefer "up to").
3. Total Experience: Overall IT field experience.
4. Relevant Experience: Must align with JD field.
5. Education: IT-related degrees only (B.E, M.Tech, etc.).
6. Gender: As per job description.
7. Skills: Languages and frameworks should match JD.
8. Stability: Ignore if 1 company <1 year; Reject if 2+ companies each <1 year.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
    elif hiring_choice == "3":
        if level_choice == "1":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Non-Sales Fresher** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Should be local and match JD.
2. Age: As per JD.
3. Total / Relevant Experience: Internship optional, but candidate should have certifications.
4. Education: Must be relevant to the JD.
5. Gender: As per JD.
6. Skills: Must align with the JD.
7. Stability: Not applicable for freshers.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
        elif level_choice == "2":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Non-Sales Experienced** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must strictly match the JD.
2. Age: As per JD.
3. Total Experience: Overall professional experience.
4. Relevant Experience: Must align with role in JD.
5. Education: Must match the JD.
6. Gender: As per JD.
7. Skills: Should align with JD and match relevant experience (skills = relevant experience).
8. Stability:
   - If 2+ companies and each job ≤1 year → Reject.
   - If 1 company and ≤1 year → Ignore stability.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""     
    elif hiring_choice == "4":
        if level_choice == "1":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Sales Support Fresher** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must be strictly local.
2. Age: As per job description.
3. Education: 12th pass & above.
4. Gender: As per job description.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""
        elif level_choice == "2":
            prompt = f"""
You are a professional HR assistant AI screening resumes for a **Sales Support Experienced** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must be strictly local.
2. Age: As per job description ("up to" logic preferred).
3. Total Experience: Add all types of sales support
4. Relevant Experience: Must match industry (strict).
5. Education: 12th pass & above accepted.
6. Gender: As per job description.
7. Skills: Skills should align with relevant experience.
8. Stability: Ignore if 1 job <1 year; Reject if 2+ jobs each <1 year.

Note: Everything should match the Job Description.

--- Response Format ---
Match %: XX%
Pros:
- ...
Cons:
- ...
Decision: ✅ Shortlist or ❌ Reject
Reason (if Rejected): ...
"""

    if not prompt:
        return "❌ Error: Invalid hiring or level choice provided."

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=800
    )
    content = response.choices[0].message.content
    if content is not None:
        result_text = content.strip()
    else:
        result_text = "Match %: 0\nDecision: ❌ Reject\nReason (if Rejected): No response from model."
    usage = getattr(response, 'usage', None)

    match_percent = 0
    match_line = re.search(r"Match\s*%:\s*(\d+)", result_text)
    if match_line:
        match_percent = int(match_line.group(1))

    if match_percent < 72:
        result_text = re.sub(r"Decision:.*", "Decision: ❌ Reject", result_text)
        if "Reason (if Rejected):" in result_text:
            result_text = re.sub(r"Reason \(if Rejected\):.*", "Reason (if Rejected): Match % below 72% threshold.", result_text)
        else:
            result_text += "\nReason (if Rejected): Match % below 72% threshold."

    return {
        "result_text": result_text,
        "match_percent": match_percent,
        "usage": {
            "prompt_tokens": getattr(usage, 'prompt_tokens', None),
            "completion_tokens": getattr(usage, 'completion_tokens', None),
            "total_tokens": getattr(usage, 'total_tokens', None)
        } if usage else None
    }

import re

def extract_candidate_name(resume_text, filename):
    # This function is now unused, but kept for reference
    return ""

def get_hiring_type_label(hiring_type):
    return {"1": "Sales", "2": "IT", "3": "Non-Sales","4":"Sales Support"}.get(hiring_type, hiring_type)

def get_level_label(level):
    return {"1": "Fresher", "2": "Experienced"}.get(level, level)

@app.post("/analyze-resumes/")
async def analyze_resumes(
    job_description: str = Form(...),
    hiring_type: str = Form(...),
    level: str = Form(...),
    files: List[UploadFile] = File(...),
    recruiter=Depends(get_current_recruiter)
):
    results = []
    shortlisted = 0
    rejected = 0
    history = []
    hiring_type_label = get_hiring_type_label(hiring_type)
    level_label = get_level_label(level)
    for file in files:
        filename = file.filename or "Unknown"
        suffix = os.path.splitext(filename)[1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        if suffix == ".pdf":
            resume_text = extract_text_from_pdf(tmp_path)
        elif suffix == ".docx":
            resume_text = extract_text_from_docx(tmp_path)
        else:
            os.unlink(tmp_path)
            error_msg = "Unsupported file type. Only PDF and DOCX are allowed."
            results.append({
                "filename": filename,
                "error": error_msg
            })
            history.append({
                "resume_name": filename,
                "hiring_type": hiring_type_label,
                "level": level_label,
                "match_percent": None,
                "decision": "Error",
                "details": error_msg
            })
            continue
        analysis = analyze_resume(job_description, resume_text, hiring_type, level)
        if isinstance(analysis, dict):
            analysis["filename"] = filename
            # Decision extraction
            decision = analysis.get("decision")
            if not decision and analysis.get("result_text"):
                match = re.search(r"Decision:\s*(✅ Shortlist|❌ Reject)", analysis["result_text"])
                if match:
                    decision = match.group(1)
            if decision and "Shortlist" in decision:
                shortlisted += 1
            elif decision and "Reject" in decision:
                rejected += 1
            decision_label = ("Shortlisted" if decision and "Shortlist" in decision else
                              "Rejected" if decision and "Reject" in decision else "-")
            analysis["decision"] = decision_label
            results.append(analysis)
            history.append({
                "resume_name": filename,
                "hiring_type": hiring_type_label,
                "level": level_label,
                "match_percent": analysis.get("match_percent"),
                "decision": decision_label,
                "details": analysis.get("result_text") or analysis.get("error", "")
            })
        else:
            results.append({"filename": filename, "error": analysis})
            history.append({
                "resume_name": filename,
                "hiring_type": hiring_type_label,
                "level": level_label,
                "match_percent": None,
                "decision": "Error",
                "details": analysis
            })
        os.unlink(tmp_path)
    # Save MIS record with history
    await mis_collection.insert_one({
        "recruiter_name": recruiter["username"],
        "total_resumes": len(files),
        "shortlisted": shortlisted,
        "rejected": rejected,
        "timestamp": datetime.utcnow(),
        "history": history
    })
    return JSONResponse(content={"results": results})

@app.get("/mis-summary")
async def mis_summary():
    pipeline = [
        {
            "$group": {
                "_id": "$recruiter_name",
                "uploads": {"$sum": 1},
                "total_resumes": {"$sum": "$total_resumes"},
                "shortlisted": {"$sum": "$shortlisted"},
                "rejected": {"$sum": "$rejected"},
                "history": {"$push": "$history"}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    summary = []
    async for row in mis_collection.aggregate(pipeline):
        # Flatten the list of lists in history
        flat_history = [item for sublist in row["history"] for item in sublist]
        summary.append({
            "recruiter_name": row["_id"],
            "uploads": row["uploads"],
            "resumes": row["total_resumes"],
            "shortlisted": row["shortlisted"],
            "rejected": row["rejected"],
            "history": flat_history
        })
    return {"summary": summary}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"message": "Backend is live!"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
