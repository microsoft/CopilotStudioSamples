import xml.etree.ElementTree as ET
import json
import re

# Define the namespace
ns = {'sp': 'http://schemas.microsoft.com/sharepoint/'}

def get_user_input(value_type, current_value):
    if value_type == bool:
        while True:
            user_input = input(f"Enter new value for boolean ('true' or 'false', current: {current_value}): ").strip().lower()
            if user_input in ['true', 'false']:
                return user_input == 'true'
            print("Invalid input for boolean, please enter 'true' or 'false'.")
    else:
        return input(f"Enter new value for {value_type} (current: {current_value}): ").strip()

def parse_properties(properties_str):
    # Replace placeholder boolean value with an actual boolean for parsing
    properties_str = properties_str.replace("TRUE_OR_FALSE", "true")  # Assuming default as true
    return json.loads(properties_str)

def update_properties(properties):
    new_properties = {}
    for key, value in properties.items():
        value_type = bool if isinstance(value, bool) else str
        new_properties[key] = get_user_input(value_type, value)
    return new_properties

def escape_json_for_xml(json_obj):
    # Dump the JSON object to a string with double quotes, and without spaces after separators
    json_str = json.dumps(json_obj, separators=(',', ':'))
    # Replace double quotes with the XML escape sequence for a quote
    escaped_json_str = json_str.replace('"', '&quot;')
    return escaped_json_str

def update_xml(file_path, new_properties):
    tree = ET.parse(file_path)
    root = tree.getroot()

    # Set the default namespace for the XML file
    ET.register_namespace('', 'http://schemas.microsoft.com/sharepoint/')

    # Convert our properties to the correctly escaped string for XML
    escaped_properties_str = escape_json_for_xml(new_properties)

    # Find the correct CustomAction element and update it
    for custom_action in root.findall(".//{http://schemas.microsoft.com/sharepoint/}CustomAction[@ClientSideComponentProperties]"):
        # Set the escaped string directly, avoiding further XML escaping
        custom_action.set('ClientSideComponentProperties', escaped_properties_str)

    # Write the updated XML to a string
    xml_str = ET.tostring(root, encoding='unicode')

    # Replace the namespace prefixes that ElementTree adds to the tags
    xml_str = re.sub(r' xmlns:ns0="[^"]+"', '', xml_str, count=1)  # Remove the xmlns attribute
    xml_str = xml_str.replace('ns0:', '')  # Remove the ns0 prefix

    # Correct the ampersand escaping issue
    xml_str = xml_str.replace('&amp;quot;', '&quot;')

    # Write the corrected XML string to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write('<?xml version="1.0" encoding="utf-8"?>\n')  # Write the XML declaration
        file.write(xml_str)

# Use the provided file path
file_path = 'sharepoint/assets/elements.xml'
tree = ET.parse(file_path)
root = tree.getroot()

# Include the namespace when finding the tag
for custom_action in root.findall("sp:CustomAction[@ClientSideComponentProperties]", ns):
    properties_str = custom_action.get('ClientSideComponentProperties')

    # Check if properties_str is not None or empty
    if properties_str:
        properties = parse_properties(properties_str)
        new_properties = update_properties(properties)
        update_xml(file_path, new_properties)

        print("XML file has been updated with new properties.")
    else:
        print("No ClientSideComponentProperties attribute found.")