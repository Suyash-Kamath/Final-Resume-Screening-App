from fastapi import FastAPI, Form
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables
load_dotenv()

SMTP_SERVER="smtp.gmail.com"
SMTP_PORT=587
EMAIL_USERNAME="suyash.kamath@probusinsurance.com"
EMAIL_PASSWORD="fyglesecpopdispr"
FROM_EMAIL="suyash.kamath@probusinsurance.com"

app = FastAPI()

class EmailSchema(BaseModel):
    to_email: str
    subject: str
    body: str

def send_email(to_email: str, subject: str, body: str):
    message = MIMEMultipart()
    message['From'] = FROM_EMAIL
    message['To'] = to_email
    message['Subject'] = subject
    message.attach(MIMEText(body, 'plain'))

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, message.as_string())
        return True
    except Exception as e:
        print("Error:", e)
        return False

@app.post("/send-email/")
def send_test_email(email: EmailSchema):
    success = send_email(email.to_email, email.subject, email.body)
    return {"status": "success" if success else "failed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("mailtest:app", host="0.0.0.0", port=8000, log_level="info")