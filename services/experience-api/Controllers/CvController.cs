using ExperienceApi.Services;
using Microsoft.AspNetCore.Mvc;

namespace ExperienceApi.Controllers;

[ApiController]
[Route("")]
public class CvController(ICvDataService cvData) : ControllerBase
{
    [HttpGet("profile")]
    public IActionResult GetProfile() => Ok(cvData.GetProfile());

    [HttpGet("experience")]
    public IActionResult GetExperience() => Ok(cvData.GetExperience());

    [HttpGet("skills")]
    public IActionResult GetSkills() => Ok(cvData.GetSkills());

    [HttpGet("cv-pdf")]
    public IActionResult GetCvPdf()
    {
        var pdfPath = cvData.GetPdfPath();
        if (!System.IO.File.Exists(pdfPath))
            return NotFound("CV PDF not bundled in this image yet.");
        return PhysicalFile(pdfPath, "application/pdf", "Tal_Shterzer_CV.pdf");
    }
}
