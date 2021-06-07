using Newtonsoft.Json;

namespace DecryptSkillBot
{
    public class TokenEncrypted
    {
        [JsonProperty("token")]
        public string token { get; set; }
    }
}
