from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import google.generativeai as genai
import os
from dotenv import load_dotenv
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://mail.google.com"],  # Allow requests from Gmail
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Initialize Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise ValueError("GEMINI_API_KEY not found in environment variables")

logger.info("Initializing Gemini API")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')
logger.info("Gemini API initialized successfully")

class EmailContent(BaseModel):
    subject: str
    sender: str
    content: str
    date: str

class EmailAnalysis(BaseModel):
    sentiment: str
    purpose: str
    context: str
    keyPoints: List[str]
    tone: str
    urgency: str
    suggestedResponseStyle: str
    logs: Optional[List[Dict[str, str]]] = []

class AnalysisRequest(BaseModel):
    email: EmailContent
    settings: Optional[dict] = None

class ResponseRequest(BaseModel):
    analysis: EmailAnalysis
    settings: Optional[dict] = None

class LoggedResponse(BaseModel):
    response: str
    logs: List[Dict[str, str]]

def log_step(step: str, details: str = "") -> Dict[str, str]:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    log_entry = {
        "timestamp": timestamp,
        "step": step,
        "details": details
    }
    logger.info(f"[{timestamp}] {step}: {details}")
    return log_entry

def create_basic_analysis_prompt(email_content: EmailContent) -> str:
    return f"""
    Analyze this email and provide:
    1. Sentiment (positive, negative, neutral)
    2. Purpose (e.g., inquiry, complaint, request, update)
    3. Context (e.g., business, personal, academic)
    4. Key points (list of main topics)

    Email:
    From: {email_content.sender}
    Subject: {email_content.subject}
    Date: {email_content.date}
    Content: {email_content.content}
    """

def create_deep_analysis_prompt(email_content: EmailContent, basic_analysis: str) -> str:
    return f"""
    Based on this initial analysis:
    {basic_analysis}

    Provide a deeper analysis of:
    1. Tone (formal, casual, urgent, etc.)
    2. Urgency level (high, medium, low)
    3. Suggested response style (formal, friendly, empathetic, etc.)

    Original email:
    From: {email_content.sender}
    Subject: {email_content.subject}
    Content: {email_content.content}
    """

def create_structure_prompt(analysis: EmailAnalysis) -> str:
    return f"""
    Based on this email analysis:
    Sentiment: {analysis.sentiment}
    Purpose: {analysis.purpose}
    Context: {analysis.context}
    Key Points: {', '.join(analysis.keyPoints)}
    Tone: {analysis.tone}
    Urgency: {analysis.urgency}
    Suggested Style: {analysis.suggestedResponseStyle}

    Generate a response structure with:
    1. Appropriate greeting
    2. Main response points
    3. Closing statement
    """

def create_refine_prompt(analysis: EmailAnalysis, structure: str) -> str:
    return f"""
    Refine this response structure to be more natural and contextually appropriate:
    
    Initial Structure:
    {structure}
    
    Analysis Context:
    - Sentiment: {analysis.sentiment}
    - Purpose: {analysis.purpose}
    - Tone: {analysis.tone}
    - Urgency: {analysis.urgency}
    - Style: {analysis.suggestedResponseStyle}
    
    Make the response:
    1. Match the original email's tone
    2. Address all key points
    3. Use appropriate formality level
    4. Include natural transitions
    """

def parse_analyses(basic_text: str, deep_text: str) -> Dict:
    """Parse both basic and deep analysis results"""
    analysis = {
        "sentiment": "neutral",
        "purpose": "general",
        "context": "business",
        "keyPoints": [],
        "tone": "neutral",
        "urgency": "medium",
        "suggestedResponseStyle": "professional"
    }
    
    # Parse basic analysis
    for line in basic_text.split('\n'):
        if "sentiment" in line.lower():
            analysis["sentiment"] = line.split(":")[-1].strip()
        elif "purpose" in line.lower():
            analysis["purpose"] = line.split(":")[-1].strip()
        elif "context" in line.lower():
            analysis["context"] = line.split(":")[-1].strip()
        elif "key points" in line.lower():
            analysis["keyPoints"] = [point.strip() for point in line.split(":")[-1].split(",")]
    
    # Parse deep analysis
    for line in deep_text.split('\n'):
        if "tone" in line.lower():
            analysis["tone"] = line.split(":")[-1].strip()
        elif "urgency" in line.lower():
            analysis["urgency"] = line.split(":")[-1].strip()
        elif "response style" in line.lower():
            analysis["suggestedResponseStyle"] = line.split(":")[-1].strip()
    
    return analysis

async def perform_basic_analysis(email_content: EmailContent) -> tuple[str, List[Dict[str, str]]]:
    """Perform basic analysis of email content"""
    logs = []
    try:
        logs.append(log_step("perform_basic_analysis:", "Starting basic analysis"))
        basic_prompt = create_basic_analysis_prompt(email_content)
        
        response = model.generate_content(basic_prompt)
        logs.append(log_step("perform_basic_analysis:", "Received LLM response"))
        
        return response.text, logs,basic_prompt
    except Exception as e:
        logs.append(log_step("perform_basic_analysis: Error", str(e)))
        raise HTTPException(status_code=500, detail=f"Error in basic analysis: {str(e)}")

async def perform_deep_analysis(email_content: EmailContent, basic_analysis: str) -> tuple[str, List[Dict[str, str]]]:
    """Perform deep analysis using basic analysis results"""
    logs = []
    try:
        logs.append(log_step("perform_deep_analysis:", "Starting deep analysis"))
        deep_prompt = create_deep_analysis_prompt(email_content, basic_analysis)
        
        response = model.generate_content(deep_prompt)
        logs.append(log_step("perform_deep_analysis:", "Received LLM response"))
        
        return response.text, logs,deep_prompt
    except Exception as e:
        logs.append(log_step("perform_deep_analysis: Error", str(e)))
        raise HTTPException(status_code=500, detail=f"Error in deep analysis: {str(e)}")

async def analyze_email_content(email_content: EmailContent, analysis_response: Optional[str] = None) -> Dict:
    """Analyze email content with optional basic analysis"""
    logs = []
    try:

        if analysis_response is None:
            logger.info("------------------------------ Step 1 ------------------------------")
            logs.append(log_step("analyze_email_content:", "No basic analysis provided, performing basic analysis"))
            analysis_response, resp_logs, prmpt = await perform_basic_analysis(email_content)
            logger.info("analyze_email_content: LLM context: \n\n" + prmpt)
            logger.info("analyze_email_content: LLM response: \n\n" + analysis_response)
            logs.extend(resp_logs)
            logger.info("------------------------------ End of Step 1 ------------------------------")
            
        # Get deep analysis using basic analysis
        logger.info("------------------------------ Step 2 ------------------------------")
        logs.append(log_step("analyze_email_content:", "Performing deep analysis"))
        deep_analysis, deep_logs, deep_prmpt = await perform_deep_analysis(email_content, analysis_response)
        logger.info("analyze_email_content: LLM context: \n\n" + deep_prmpt)
        logger.info("analyze_email_content: LLM response: \n\n" + deep_analysis)
        logs.extend(deep_logs)
        logger.info("------------------------------ End of Step 2 ------------------------------")
        
        # Parse and return combined analysis
        logger.info("------------------------------ Step 3 ------------------------------")
        logs.append(log_step("analyze_email_content:", "Parsing analysis results"))
        analysis = parse_analyses(analysis_response, deep_analysis)
        logger.info("analyze_email_content: Structured final output: \n\n" + str(analysis))
        analysis["logs"] = logs
        logger.info("------------------------------ End of Step 3 ------------------------------")
        return analysis
    
    except Exception as e:
        logs.append(log_step("analyze_email_content: Error", str(e)))
        raise HTTPException(status_code=500, detail=f"Error in email analysis: {str(e)}")

async def generate_email_response(analysis: EmailAnalysis, structure: Optional[str] = None) -> tuple[str, List[Dict[str, str]]]:
    """Generate email response with optional structure"""
    logs = []
    try:
        # Generate response directly
        logs.append(log_step("generate_email_response:", "Starting response generation"))
        response_prompt = f"""
        Generate a professional email response based on this analysis:
        Sentiment: {analysis.sentiment}
        Purpose: {analysis.purpose}
        Context: {analysis.context}
        Key Points: {', '.join(analysis.keyPoints)}
        Tone: {analysis.tone}
        Urgency: {analysis.urgency}
        Suggested Style: {analysis.suggestedResponseStyle}

        Generate a response that:
        1. Uses appropriate greeting based on the context and tone
        2. Addresses all key points from the original email
        3. Matches the original email's tone and formality level
        4. Includes natural transitions between points
        5. Ends with an appropriate closing statement

        response format:
        - String that only has the following contents:
        Subject: [Subject line for the response]
        Body: [Body of the response]
        """
        logger.info("------------------------------ Final Step ------------------------------")
        logs.append(log_step("generate_email_response:", "Created prompt"))
        response = model.generate_content(response_prompt)
        logger.info("generate_email_response: prompt: \n\n" + response_prompt)
        logger.info("\ngenerate_email_response: Received LLM response\n")
        logger.info("generate_email_response: Response: \n\n" + response.text)
        logger.info("------------------------------ End of Final Step ------------------------------")
        return response.text, logs
    
    except Exception as e:
        logs.append(log_step("generate_email_response: Error", str(e)))
        raise HTTPException(status_code=500, detail=f"Error in response generation: {str(e)}")

@app.post("/analyze", response_model=EmailAnalysis)
async def analyze_email(request: AnalysisRequest):
    logger.info(f"Received analyze request for email from: {request.email.sender}")
    logger.info(f"Request body: {request.dict()}")
    try:
        analysis = await analyze_email_content(request.email)
        logger.info("Email analysis completed successfully")
        return EmailAnalysis(**analysis)
    except Exception as e:
        logger.error(f"Error in analyze_email: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-response", response_model=LoggedResponse)
async def generate_response(request: ResponseRequest):
    logger.info("Received generate-response request")
    logger.info(f"Request body: {request.dict()}")
    try:
        response, logs = await generate_email_response(request.analysis)
        logger.info("Response generated successfully")
        return LoggedResponse(response=response, logs=logs)
    except Exception as e:
        logger.error(f"Error in generate_response: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 