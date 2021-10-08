using Newtonsoft.Json;

namespace DecryptSkillBot
{
    public class UserId
    {
        [JsonProperty("id")]
        public string Id{ get; set; }
    }
}