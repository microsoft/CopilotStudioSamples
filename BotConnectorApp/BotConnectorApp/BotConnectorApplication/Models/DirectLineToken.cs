using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BotConnectorApplication.Models
{
    public class DirectLineToken
    {
        /// <summary>
        /// constructor
        /// </summary>
        /// <param name="token">Directline token string</param>
        public DirectLineToken(string token)
        {
            Token = token;
        }

        public string Token { get; set; }
    }
}
