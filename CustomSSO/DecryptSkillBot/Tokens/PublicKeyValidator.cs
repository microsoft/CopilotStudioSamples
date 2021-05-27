using System;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace DecryptSkillBot.Tokens
{
    /// <summary>
    /// Downloads and validates the public key used is this skill.
    /// </summary>
    public class PublicKeyValidator
    {
        private const string ConfigKey = "PublicKeyUrl";
        private const string CacheKey = "PublicKeyCacheKey";
        private readonly string _publicKeyUrl;
        private readonly string _publicKeyCacheKey;
        private IMemoryCache _memoryCache;

        public PublicKeyValidator(IConfiguration config, IMemoryCache memoryCache)
        {
            
            // Null check cache
            if (memoryCache == null)
            {
                throw new ArgumentNullException(nameof(memoryCache));
            }

            // Null check config
            if (config == null)
            {
                throw new ArgumentNullException(nameof(config));
            }

            // PublicKeyCacheKey is the setting in the appsettings.json file
            // that is the key used to cache public key value
            string keyValue = config.GetValue<string>(CacheKey);
       
            if (string.IsNullOrEmpty(keyValue))
            {
                throw new ArgumentNullException($"\"{CacheKey}\" not found in configuration.");
            }

            // PublicKeyUrl is the setting in the appsettings.json file
            // that consists of the Url endpoint of the Public Key used to validate a users token in this skill.
            string urlValue = config.GetValue<string>(ConfigKey);

            if (string.IsNullOrEmpty(urlValue))
            {
                throw new ArgumentNullException($"\"{ConfigKey}\" not found in configuration.");
            }

            _publicKeyCacheKey = keyValue;
            _publicKeyUrl = urlValue;
            _memoryCache = memoryCache;
        }

        /// <summary>
        /// Downloads the key from the supplied config url. Checks for cached value and stores if empty.
        /// </summary>
        public async Task<string> GetPublicKey()
        {
            string keyBody; ;

            //Check for existing cache value
            bool isCached = _memoryCache.TryGetValue(CacheKey, out keyBody);
            
            // if no cache value exists, download and store to cache
            if (!isCached)
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(_publicKeyUrl);
                request.AutomaticDecompression = DecompressionMethods.GZip;

                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                using (Stream stream = response.GetResponseStream())
                using (StreamReader reader = new StreamReader(stream))
                {
                    keyBody = await reader.ReadToEndAsync();
                }

                if (string.IsNullOrEmpty(keyBody))
                {
                    throw new ArgumentOutOfRangeException(nameof(keyBody));
                }

                // Store to cache for 1 hour          
                var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetSlidingExpiration(TimeSpan.FromMinutes(60));

                _memoryCache.Set(CacheKey, keyBody, cacheEntryOptions);
            }

            return keyBody;
        }
    }
}
