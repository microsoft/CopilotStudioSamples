// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace PVATestFramework.Console.Models.Dataverse
{
    internal class InputDataverse
    {
        [JsonProperty("@odata.context")]
        public string OdataContext { get; set; }

        [JsonProperty("value")]
        public List<JSValue> Value { get; set; }
    }

    public class JSValue
    {
        [JsonProperty("@odata.etag")]
        public string OdataEtag { get; set; }

        [JsonProperty("conversationstarttime")]
        public DateTime Conversationstarttime { get; set; }

        [JsonProperty("schemaversion")]
        public string Schemaversion { get; set; }

        [JsonProperty("_owningbusinessunit_value")]
        public string OwningbusinessunitValue { get; set; }

        [JsonProperty("conversationtranscriptid")]
        public string Conversationtranscriptid { get; set; }

        [JsonProperty("statecode")]
        public int Statecode { get; set; }

        [JsonProperty("statuscode")]
        public int Statuscode { get; set; }

        [JsonProperty("_createdby_value")]
        public string CreatedbyValue { get; set; }

        [JsonProperty("metadata")]
        public string Metadata { get; set; }

        [JsonProperty("timezoneruleversionnumber")]
        public int Timezoneruleversionnumber { get; set; }

        [JsonProperty("_ownerid_value")]
        public string OwneridValue { get; set; }

        [JsonProperty("modifiedon")]
        public DateTime Modifiedon { get; set; }

        [JsonProperty("_modifiedby_value")]
        public string ModifiedbyValue { get; set; }

        [JsonProperty("_owninguser_value")]
        public string OwninguserValue { get; set; }

        [JsonProperty("createdon")]
        public DateTime Createdon { get; set; }

        [JsonProperty("schematype")]
        public string Schematype { get; set; }

        [JsonProperty("versionnumber")]
        public int Versionnumber { get; set; }

        [JsonProperty("_bot_conversationtranscriptid_value")]
        public string BotConversationtranscriptidValue { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("content")]
        public string Content { get; set; }

        [JsonProperty("overriddencreatedon")]
        public object Overriddencreatedon { get; set; }

        [JsonProperty("importsequencenumber")]
        public object Importsequencenumber { get; set; }

        [JsonProperty("_modifiedonbehalfby_value")]
        public object ModifiedonbehalfbyValue { get; set; }

        [JsonProperty("utcconversiontimezonecode")]
        public object Utcconversiontimezonecode { get; set; }

        [JsonProperty("_createdonbehalfby_value")]
        public object CreatedonbehalfbyValue { get; set; }

        [JsonProperty("_owningteam_value")]
        public object OwningteamValue { get; set; }
    }
}
