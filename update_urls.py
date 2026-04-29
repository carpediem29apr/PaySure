import os
import re

files = [
    'frontend/src/pages/Index.tsx',
    'frontend/src/components/paysure/TransactionDetail.tsx',
    'frontend/src/components/paysure/Header.tsx',
    'frontend/src/components/paysure/ProfileSheet.tsx'
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    if 'import { API_BASE }' not in content:
        content = 'import { API_BASE } from "@/lib/api";\n' + content
        
    content = re.sub(r'"http://localhost:8000([^"]*)"', r'`${API_BASE}\1`', content)
    content = re.sub(r'`http://localhost:8000([^`]*)`', r'`${API_BASE}\1`', content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

print('Done!')
