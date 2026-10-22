/**
 * GUID Encoder - Converts GUID to Base64URL encoded format
 * 
 * This script converts a GUID (UUID) to Base64URL encoding using little-endian
 * byte order for the first three parts (matching .NET GUID structure).
 * 
 * Usage:
 *   node guid-encoder.js <guid>
 * 
 * Example:
 *   node guid-encoder.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */

const crypto = require('crypto');

/**
 * Converts a GUID string to Base64URL encoded format
 * @param {string} guid - The GUID to encode (with or without hyphens)
 * @returns {string} Base64URL encoded GUID
 */
function encodeGuidToBase64Url(guid) {
  // Remove hyphens and convert to lowercase
  const guidNoDashes = guid.replace(/-/g, '').toLowerCase();
  
  // Validate GUID format (32 hex characters)
  if (!/^[0-9a-f]{32}$/i.test(guidNoDashes)) {
    throw new Error(`Invalid GUID format: ${guid}`);
  }
  
  // Extract parts of the GUID
  // GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // Byte order needs to be adjusted for little-endian encoding
  const part1 = guidNoDashes.substring(0, 8);   // First 8 chars (4 bytes)
  const part2 = guidNoDashes.substring(8, 12);  // Next 4 chars (2 bytes)
  const part3 = guidNoDashes.substring(12, 16); // Next 4 chars (2 bytes)
  const part4 = guidNoDashes.substring(16, 32); // Last 16 chars (8 bytes)
  
  // Reverse byte order for first three parts (little-endian)
  // This matches how .NET stores GUIDs in memory
  let hexBytes = '';
  
  // Part 1: Reverse 4 bytes (8 hex chars)
  hexBytes += part1.substring(6, 8) + part1.substring(4, 6) + 
              part1.substring(2, 4) + part1.substring(0, 2);
  
  // Part 2: Reverse 2 bytes (4 hex chars)
  hexBytes += part2.substring(2, 4) + part2.substring(0, 2);
  
  // Part 3: Reverse 2 bytes (4 hex chars)
  hexBytes += part3.substring(2, 4) + part3.substring(0, 2);
  
  // Part 4: Keep original order (big-endian)
  hexBytes += part4;
  
  // Convert hex string to Buffer
  const buffer = Buffer.from(hexBytes, 'hex');
  
  // Convert to base64
  const base64 = buffer.toString('base64');
  
  // Convert to Base64URL format:
  // - Replace + with -
  // - Replace / with _
  // - Remove padding (=)
  const base64Url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return base64Url;
}

/**
 * Main execution
 */
function main() {
  // Get GUID from command line arguments
  const guid = process.argv[2];
  const quietMode = process.argv.includes('--quiet') || process.argv.includes('-q');
  
  if (!guid) {
    console.error('Error: GUID argument is required');
    console.error('');
    console.error('Usage: node guid-encoder.js <guid> [--quiet]');
    console.error('');
    console.error('Example:');
    console.error('  node guid-encoder.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890"');
    console.error('  node guid-encoder.js "a1b2c3d4-e5f6-7890-abcd-ef1234567890" --quiet');
    process.exit(1);
  }
  
  try {
    // Suppress debug output in quiet mode
    if (!quietMode) {
      console.log(`Converting GUID: ${guid}`);
    }
    
    const encoded = encodeGuidToBase64Url(guid);
    
    if (quietMode) {
      // Quiet mode: Only output EncodedTenantID=xxxx
      console.log(`EncodedTenantID=${encoded}`);
    } else {
      // Verbose mode: Output detailed information
      const result = {
        guid: guid,
        encodedGuid: encoded
      };
      
      console.log('');
      console.log('Result:');
      console.log(JSON.stringify(result, null, 2));
      
      console.log('');
      console.log('Encoded GUID:');
      console.log(encoded);
    }
    
    return encoded;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { encodeGuidToBase64Url };

// Run if executed directly
if (require.main === module) {
  main();
}
