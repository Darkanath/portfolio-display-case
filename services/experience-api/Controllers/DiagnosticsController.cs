using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;

namespace ExperienceApi.Controllers;

[ApiController]
[ApiVersionNeutral]
[Route("")]
public class DiagnosticsController : ControllerBase
{
    private const string ServiceName = "experience-api";
    private const string ServiceVersion = "2.0.0";

    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new { status = "ok", service = ServiceName, version = ServiceVersion });

    [HttpGet("version")]
    public ContentResult Version() =>
        Content(ServiceVersion, "text/plain");
}
