from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from datetime import timedelta
from io import BytesIO
import os

from models.schema import Token, QueryRequest, QueryResponse
from services.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES, FAKE_USERS_DB, get_user,
    create_access_token, get_current_user, get_current_admin_user
)
from services.parser import extract_text_from_file
from services.vector_db import (
    add_document_to_db, query_relevant_chunks, generate_answer_from_context,
    delete_document_from_db, get_all_documents
)

app = FastAPI(title="Document Search Bot")

# CORS middleware to allow the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

@app.post("/api/token", response_model=Token)

@app.post("/api/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Get the user object from our simple database
    user = get_user(FAKE_USERS_DB, form_data.username)
    
    # Perform a simple password comparison
    if not user or form_data.password != user["password"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # If login is successful, create and return the token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "role": user["role"]}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}

@app.post("/api/upload", status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...), current_user: dict = Depends(get_current_admin_user)):
    if file.size > 2 * 1024 * 1024: # 2MB limit
        raise HTTPException(status_code=413, detail="File size exceeds the 2MB limit.")

    # Define the path where the file will be saved
    upload_folder = "uploads"
    os.makedirs(upload_folder, exist_ok=True) # Create the folder if it doesn't exist
    file_path = os.path.join(upload_folder, file.filename)
    # --- END OF NEW CODE ---

    try:
        # Save the file to the disk first
        with open(file_path, "wb") as buffer:
            content = await file.read() 
            buffer.write(content)      
        # Reset the stream position to the beginning for further processing
        await file.seek(0)
        # --- END OF MODIFIED CODE ---

        # Now, process the file for the vector DB (this part is the same as before)
        content_for_processing = await file.read()
        file_content_io = BytesIO(content_for_processing)
        text = extract_text_from_file(file_content_io, file.filename)

        # Check if text was extracted. If not, don't add to DB and warn user.
        if not text or not text.strip():
            # We still keep the file, but warn the admin.
            return {"message": f"Warning: Document '{file.filename}' was uploaded but contained no extractable text. It has not been added to the chat knowledge base."}

        add_document_to_db(text, doc_id=file.filename)

    except ValueError as e:
        raise HTTPException(status_code=415, detail=str(e))
    except Exception as e:
        # If something goes wrong, optionally delete the partially saved file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
    finally:
        await file.close()

    return {"message": f"Document '{file.filename}' uploaded and processed successfully."}

@app.get("/api/documents")
async def list_documents(current_user: dict = Depends(get_current_admin_user)):
    documents = get_all_documents()
    return {"documents": documents}

@app.delete("/api/documents/{doc_id}", status_code=status.HTTP_200_OK)
async def delete_document(doc_id: str, current_user: dict = Depends(get_current_admin_user)):
    try:
        delete_document_from_db(doc_id)
        return {"message": f"Document '{doc_id}' deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not delete document: {e}")

@app.post("/api/query", response_model=QueryResponse)
async def ask_query(request: QueryRequest, current_user: dict = Depends(get_current_user)):
    relevant_chunks = query_relevant_chunks(request.query)
    answer = generate_answer_from_context(relevant_chunks, request.query)
    return {"answer": answer}