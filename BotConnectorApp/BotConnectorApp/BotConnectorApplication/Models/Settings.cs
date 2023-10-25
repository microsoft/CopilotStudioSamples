using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BotConnectorApplication.Models
{
    public class Settings
    {
        public string BotId { get; set; }
        public string BotTenantId { get; set; }
        public string BotName { get; set; }
        public string BotTokenEndpoint { get; set; }
        public string EndConversationMessage { get; set; }
    }
}
