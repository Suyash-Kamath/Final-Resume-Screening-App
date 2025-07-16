from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import pdfplumber
import docx
import tempfile
import os
import re
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Make sure to set OPENAI_API_KEY in your .env file
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

def extract_text_from_pdf(filepath):
    with pdfplumber.open(filepath) as pdf:
        return '\n'.join(page.extract_text() for page in pdf.pages if page.extract_text())

def extract_text_from_docx(filepath):
    doc = docx.Document(filepath)
    return '\n'.join(para.text for para in doc.paragraphs)

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
You are a professional HR assistant AI screening resumes for a **Sales Experienced** role.

--- Job Description ---
{jd}

--- Candidate Resume ---
{resume_text}

--- Screening Criteria ---
1. Location: Must be strictly local.
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

@app.post("/analyze-resumes/")
async def analyze_resumes(
    job_description: str = Form(...),
    hiring_type: str = Form(...),
    level: str = Form(...),
    files: List[UploadFile] = File(...)
):
    results = []
    for file in files:
        filename = file.filename or ""
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
            results.append({
                "filename": filename,
                "error": "Unsupported file type. Only PDF and DOCX are allowed."
            })
            continue
        analysis = analyze_resume(job_description, resume_text, hiring_type, level)
        if isinstance(analysis, dict):
            analysis["filename"] = filename
            results.append(analysis)
        else:
            results.append({"filename": filename, "error": analysis})
        os.unlink(tmp_path)
    return JSONResponse(content={"results": results})
 