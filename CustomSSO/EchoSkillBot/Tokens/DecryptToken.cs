using Microsoft.IdentityModel.Tokens;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;

namespace DecryptSkillBot
{
    public static class DecryptToken
    {
        // Decrypt a JWT Token using a public key. Returns the ID value from the JWT Token
        // By default looks to return the claim 'sub' from the token - assuming this is the User ID
        public static string GetUserID(TokenEncrypted token)
        {
            string userId;

            // we return an empty string here in order to keep the front end running smoothly, but this could
            // throw an exception or return an error string as needed
            if (!ValidateCurrentToken(token.token))
            {
                userId = String.Empty;
            }
            else
            {
                userId = GetClaim(token.token, "sub");
            }

            return userId;
        }

        //Validate the JWT token
        private static bool ValidateCurrentToken(string token)
        {
                        
            var tokenHandler = new JwtSecurityTokenHandler();
            try
            {
                tokenHandler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidIssuer = myIssuer,
                    ValidAudience = myAudience,
                    IssuerSigningKey = mySecurityKey
                }, out SecurityToken validatedToken);
            }
            catch
            {
                return false;
            }
            return true;
        }

        private static string GetClaim(string token, string claimType)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var securityToken = tokenHandler.ReadToken(token) as JwtSecurityToken;

            var stringClaimValue = securityToken.Claims.First(claim => claim.Type == claimType).Value;
            return stringClaimValue;
        }

        private static string GetPublicKey()
        {
            keyUrl = 
        }
    }
}
}
