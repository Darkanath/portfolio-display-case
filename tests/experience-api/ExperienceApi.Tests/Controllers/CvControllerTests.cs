using ExperienceApi.Controllers;
using ExperienceApi.Models;
using ExperienceApi.Services;

namespace ExperienceApi.Tests.Controllers;

public class CvControllerTests
{
    private readonly ICvDataService _cvData = Substitute.For<ICvDataService>();
    private readonly CvController _sut;

    public CvControllerTests()
    {
        _sut = new CvController(_cvData);
    }

    [Fact]
    public void GetProfile_ReturnsOkWithProfile()
    {
        var profile = new Profile("Tal", "EM", "Summary", "IL", 17);
        _cvData.GetProfile().Returns(profile);

        var result = _sut.GetProfile();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(profile, ok.Value);
    }

    [Fact]
    public void GetExperience_ReturnsOkWithList()
    {
        var entries = new List<ExperienceEntry>
        {
            new("id1", "Dev", "Acme", "2020", null, true, [], [])
        };
        _cvData.GetExperience().Returns(entries);

        var result = _sut.GetExperience();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(entries, ok.Value);
    }

    [Fact]
    public void GetSkills_ReturnsOkWithSkills()
    {
        var skills = new Skills(["C#"], ["Azure"], ["SQL"], ["Claude"], ["Hiring"], ["CI/CD"]);
        _cvData.GetSkills().Returns(skills);

        var result = _sut.GetSkills();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(skills, ok.Value);
    }

    [Fact]
    public void GetMilitaryService_ReturnsOkWithList()
    {
        var entries = new List<MilitaryServiceEntry>
        {
            new("Full service", "Home Front Command", "Communications & Computer Department")
        };
        _cvData.GetMilitaryService().Returns(entries);

        var result = _sut.GetMilitaryService();

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(entries, ok.Value);
    }

    [Fact]
    public void GetCvPdf_FileNotFound_ReturnsNotFound()
    {
        _cvData.GetPdfPath().Returns(Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".pdf"));

        var result = _sut.GetCvPdf();

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public void GetCvPdf_FileExists_ReturnsPhysicalFile()
    {
        var tmp = Path.GetTempFileName();
        try
        {
            File.WriteAllBytes(tmp, [0x25, 0x50, 0x44, 0x46]); // %PDF header
            _cvData.GetPdfPath().Returns(tmp);

            var result = _sut.GetCvPdf();

            var file = Assert.IsType<PhysicalFileResult>(result);
            Assert.Equal("application/pdf", file.ContentType);
        }
        finally
        {
            File.Delete(tmp);
        }
    }
}
