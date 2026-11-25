import openpyxl
import os

files = [
    r'S:\files\food_app\selenium-tests\reports\FoodieBite_Selenium_E2E_Analysis_Report.xlsx',
    r'S:\files\food_app\selenium-tests\reports\FoodieBite_Selenium_E2E_Test_Report.xlsx',
    r'S:\files\food_app\Vulnerability Test Results\FoodieBite_Selenium_E2E_Analysis_Report.xlsx'
]
for f in files:
    if os.path.exists(f):
        wb = openpyxl.load_workbook(f, read_only=True)
        print('FILE:', f)
        print('  Sheets:', wb.sheetnames)
        for s in wb.sheetnames:
            ws = wb[s]
            print(f'    Sheet {s}: max_row={ws.max_row}')
