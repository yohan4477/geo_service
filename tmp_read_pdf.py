from pypdf import PdfReader
import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'c:\Users\y\Downloads\Open API 샘플가이드_20220406.pdf'
reader = PdfReader(path)
for index, page in enumerate(reader.pages, start=1):
    text = page.extract_text() or ''
    print(f'--- Page {index} ---')
    print(text)
