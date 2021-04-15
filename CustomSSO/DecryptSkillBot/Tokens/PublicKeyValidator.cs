using System;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace DecryptSkillBot.Tokens
{
    /// <summary>
    /// Downloads and validates the public key used is this skill.
    /// </summary>
    public class PublicKeyValidator
    {
        private const string ConfigKey = "PublicKeyUrl";
        private readonly string _publicKeyUrl;

        public PublicKeyValidator(IConfiguration config)
        {
            if (config == null)
            {
                throw new ArgumentNullException(nameof(config));
            }

            // PublicKeyUrl is the setting in the appsettings.json file
            // that consists of the Url endpoint of the Public Key used to validate a users token in this skill.
            string value = config.GetValue<string>(ConfigKey);
       
            if (String.IsNullOrEmpty(value))
            {
                throw new ArgumentNullException($"\"{ConfigKey}\" not found in configuration.");
            }

            _publicKeyUrl = value;
        }

        /// <summary>
        /// Downloads the key from the supplied config url. Checks for cached value and stores if empty.
        /// </summary>
        public async Task<string> GetPublicKey()
        {
            if (String.IsNullOrEmpty(_publicKeyUrl))
            {
                throw new ArgumentNullException(nameof(_publicKeyUrl));
            }

            string body = string.Empty;

            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(_publicKeyUrl);
            request.AutomaticDecompression = DecompressionMethods.GZip;

            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (Stream stream = response.GetResponseStream())
            using (StreamReader reader = new StreamReader(stream))
            {
                body = await reader.ReadToEndAsync();
            }

            if (String.IsNullOrEmpty(body))
            {
                throw new ArgumentOutOfRangeException(nameof(body));
            }

            return body;
        }
    }
}
