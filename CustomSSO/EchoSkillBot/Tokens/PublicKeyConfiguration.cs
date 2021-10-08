namespace DecryptSkillBot.Tokens
{
    public class PublicKeyConfiguration
    {
        public string Url;

        public virtual PublicKeyValidator PublicKeyValidator { get; set; }
    }
}
