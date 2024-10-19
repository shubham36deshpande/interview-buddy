from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import google.generativeai as genai
import time
import docx  # Library for reading .docx files
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Replace with your actual secret key

UPLOAD_FOLDER = 'uploads/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Set your Gemini API key (replace with your actual key)
os.environ["GOOGLE_API_KEY"] = ""  # Replace with your actual Gemini API key
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

@app.route("/")
def index():
    return render_template("index.html")

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            session['file_path'] = file_path  # Save the file path in session for later use
            return redirect(url_for('ask_question'))

    except Exception as e:
        print(f"Upload Error: {e}")
        return jsonify({'error': 'File upload failed. Please try again.'}), 500

@app.route('/ask_question')
def ask_question():
    return render_template('ask_question.html')

@app.route('/ask_gemini', methods=['POST'])
def ask_gemini():
    question_data = request.get_json()
    question = question_data.get('question')

    if question:
        try:
            if 'file_path' in session:
                file_path = session['file_path']
                document_text = read_docx_to_text(file_path)
                
                # Validate that document text is not an error message
                if document_text.startswith("Error reading file:"):
                    return jsonify({'error': document_text}), 500
                
                model = genai.GenerativeModel('gemini-1.5-flash')
                prompt = f"""Act like you are the candidate from this info: {document_text}
                    Your project was on AWS Lambda and Glue, and when I ask questions, you should answer them as if I am interviewing 
                    you. Answers should be like an experienced AWS data engineer. The input that you are getting is a question from an interview, 
                    so understand it in that way and provide a concise answer to the following question in bullet points where applicable: {question}"""
                
                response = model.generate_content(prompt)
                answer = response.text  # Corrected to access the proper attribute
                return jsonify({'answer': answer})
            else:
                return jsonify({'error': 'File not uploaded'}), 400

        except Exception as e:
            print(f"Gemini API Error: {e}")
            return jsonify({'error': str(e)}), 500  # Return error as JSON

    else:
        return jsonify({'error': 'No question provided'}), 400
def read_docx_to_text(path_to_file):
    """Reads a .docx file and returns its content as plain text."""
    doc = docx.Document(path_to_file)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

if __name__ == "__main__":
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    app.run(debug=True)
