import os
import google.generativeai as genai
import docx
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_FOLDER', 'uploads/')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Configure Gemini API
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))

ALLOWED_EXTENSIONS = {'docx', 'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'resume' not in request.files:
            print("No file part in the request.")
            return jsonify({'error': 'No file part'}), 400

        file = request.files['resume']
        if file.filename == '':
            print("No file selected.")
            return jsonify({'error': 'No selected file'}), 400

        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            session['file_path'] = file_path  # Save the file path in session for later use
            print(f"File uploaded successfully to {file_path}")
            return jsonify({'success': True})
    except Exception as e:
        print(f"Error during file upload: {e}")
        return jsonify({'error': 'File upload failed. Please try again.'}), 500

@app.route('/ask_question')
def ask_question():
    if 'file_path' not in session:
        return redirect(url_for('index'))
    return render_template('ask_question.html')

@app.route('/ask_gemini', methods=['POST'])
def ask_gemini():
    question_data = request.get_json()
    question = question_data.get('question')

    if not question:
        return jsonify({'error': 'No question provided'}), 400

    if 'file_path' not in session:
        return jsonify({'error': 'File not uploaded'}), 400

    try:
        file_path = session['file_path']
        document_text = read_document(file_path)

        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""Act as the candidate described in this information: {document_text}
            Your project involved AWS Lambda and Glue. Answer the following interview question
            as an experienced AWS data engineer. Provide a concise answer in bullet points
            where applicable: {question}"""

        response = model.generate_content(prompt)
        answer = response.text
        return jsonify({'answer': answer})

    except Exception as e:
        app.logger.error(f"Gemini API Error: {e}")
        return jsonify({'error': 'An error occurred while processing your request. Please try again.'}), 500

def read_document(file_path):
    """Reads a .docx or .pdf file and returns its content as plain text."""
    file_extension = os.path.splitext(file_path)[1].lower()

    if file_extension == '.docx':
        return read_docx(file_path)
    elif file_extension == '.pdf':
        return read_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_extension}")

def read_docx(file_path):
    """Reads a .docx file and returns its content as plain text."""
    try:
        doc = docx.Document(file_path)
        return '\n'.join([para.text for para in doc.paragraphs])
    except Exception as e:
        app.logger.error(f"Error reading .docx file: {e}")
        raise

def read_pdf(file_path):
    """Reads a .pdf file and returns its content as plain text."""
    try:
        # Implement PDF reading logic here
        # For example, using PyPDF2 or pdfminer.six
        return "PDF content extraction not implemented yet."
    except Exception as e:
        app.logger.error(f"Error reading .pdf file: {e}")
        raise

if __name__ == "__main__":
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=os.getenv('FLASK_DEBUG', 'False') == 'True')