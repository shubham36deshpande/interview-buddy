from flask import Flask, render_template, request, jsonify
import os
import google.generativeai as genai
import datetime
import time
import docx

app = Flask(__name__)

# Set your Gemini API key (replace with your actual key)
os.environ["GOOGLE_API_KEY"] = ""  # Replace with your actual Gemini API key
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

@app.route("/")
def index():
    return render_template("index.html")

def read_docx_as_string(file_path):
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    return '\n'.join(full_text)

@app.route('/ask_gemini', methods=['POST'])
def ask_gemini():
    question_data = request.get_json()
    question = question_data.get('question')

    file_path = "C:\\Users\\shubh\\Downloads\\intro and project.docx"
    info = read_docx_as_string(file_path)

    if question:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""Act like yuo are the candidate from this info: {info}\n#### \n the input that you are getting is a question from inerview, 
                so understand it in that way and provide a concise answer to the following question in bullet points where applicable: {question}"""
            response = model.generate_content(prompt)
            answer = response.text  # Corrected to access the proper attribute
            return jsonify({'answer': answer})
        except Exception as e:
            return jsonify({'error': str(e)}), 500  # Return error as JSON
    else:
        return jsonify({'error': 'No question provided'}), 400

if __name__ == "__main__":
    app.run(debug=True)
