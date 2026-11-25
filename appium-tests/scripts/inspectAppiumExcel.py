import openpyxl

wb = openpyxl.load_workbook(r'S:\files\food_app\appium-tests\reports\FoodieBite_Appium_Mobile_E2E_Analysis_Report.xlsx', read_only=True)
print('Sheets in Appium Analysis Report:', wb.sheetnames)
for s in wb.sheetnames:
    print(f'  Sheet {s}: max_row={wb[s].max_row}')

wb2 = openpyxl.load_workbook(r'S:\files\food_app\appium-tests\reports\FoodieBite_Appium_E2E_Test_Report.xlsx', read_only=True)
print('Sheets in Appium Test Report:', wb2.sheetnames)
for s in wb2.sheetnames:
    print(f'  Sheet {s}: max_row={wb2[s].max_row}')
