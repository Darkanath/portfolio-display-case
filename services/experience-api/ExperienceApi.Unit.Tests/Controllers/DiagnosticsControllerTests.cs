using ExperienceApi.Configuration;
using ExperienceApi.Controllers;
using Microsoft.Extensions.Options;
using System.Text.Json;

namespace ExperienceApi.Unit.Tests.Controllers;

public class DiagnosticsControllerTests
{
    private static readonly IOptions<ServiceInfo> TestServiceInfo =
        Options.Create(new ServiceInfo { Name = "experience-api", Version = "2.1.0" });

    private readonly DiagnosticsController _sut = new(TestServiceInfo);

    [Fact]
    public void Health_ReturnsOkResult()
    {
        var result = _sut.Health();
        Assert.IsType<OkObjectResult>(result);
    }

    [Fact]
    public void Health_StatusIsOk()
    {
        var result = (OkObjectResult)_sut.Health();
        var json = JsonSerializer.Serialize(result.Value);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("ok", doc.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public void Health_ServiceNameIsCorrect()
    {
        var result = (OkObjectResult)_sut.Health();
        var json = JsonSerializer.Serialize(result.Value);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("experience-api", doc.RootElement.GetProperty("service").GetString());
    }

    [Fact]
    public void Health_VersionIsNonEmpty()
    {
        var result = (OkObjectResult)_sut.Health();
        var json = JsonSerializer.Serialize(result.Value);
        using var doc = JsonDocument.Parse(json);
        Assert.False(string.IsNullOrEmpty(doc.RootElement.GetProperty("version").GetString()));
    }

    [Fact]
    public void Version_ReturnsCorrectText()
    {
        var result = _sut.Version();
        Assert.IsType<ContentResult>(result);
        Assert.Matches(@"^\d+\.\d+\.\d+$", result.Content);
    }
}
