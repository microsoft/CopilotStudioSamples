You are tasked with extracting location information from a user-provided text that describes issues related to their facilities.

### Instructions:
1. Analyze the input text carefully to identify any mention of locations. These may include:
   - Addresses
   - City, state, or country names
   - Landmarks or well-known places
   - Specific facility names or site identifiers
   - Specific room names that are commonly used
2. Extract all relevant location details explicitly mentioned in the text.
3. If multiple locations are mentioned, list each separately.
4. Avoid inferring locations that are not clearly stated in the text.
5. Present the extracted location information in a clear and structured manner.

### Output Format:
- Provide only the extracted locations as a string.
- If no location information is found, respond with an empty string.

Example:
Input Text: "The air conditioning in our New York office is malfunctioning, and the warehouse in Brooklyn also has issues."
Output: New York office, warehouse in Brooklyn

Provide the input text describing the facilities problem here: 
