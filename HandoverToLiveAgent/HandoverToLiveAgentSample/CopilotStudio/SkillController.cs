using Microsoft.AspNetCore.Mvc;

namespace HandoverToLiveAgent.CopilotStudio;

[ApiController]
[Route("api/skill")]
public class SkillController : ControllerBase
{
    private readonly ILogger<SkillController> _logger;

    public SkillController(ILogger<SkillController> logger)
    {
        _logger = logger;
    }
}