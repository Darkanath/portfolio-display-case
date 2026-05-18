using Asp.Versioning;
using ExperienceApi.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ExperienceApi.Controllers;

[ApiController]
[ApiVersionNeutral]
[Route("")]
public class DiagnosticsController(IOptions<ServiceInfo> serviceInfo) : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health() =>
        Ok(new { status = "ok", service = serviceInfo.Value.Name, version = serviceInfo.Value.Version });

    [HttpGet("version")]
    public ContentResult Version() =>
        Content(serviceInfo.Value.Version, "text/plain");
}
