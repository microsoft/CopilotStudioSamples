using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BotConnectorApp.Service.Models
{
    public class DirectLineToken
    {
        public string Token { get; set; }
        public int Expires_in { get; set; }
        public string ConversationId { get; set; }
    }
}
