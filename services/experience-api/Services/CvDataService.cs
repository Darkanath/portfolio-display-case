using System.Text.Json;
using ExperienceApi.Models;

namespace ExperienceApi.Services;

public sealed class CvDataService : ICvDataService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly CvDocument _cv;
    private readonly string _pdfPath;

    public CvDataService()
    {
        var dataDir = Path.Combine(AppContext.BaseDirectory, "data");
        var json = File.ReadAllText(Path.Combine(dataDir, "cv.json"));
        _cv = JsonSerializer.Deserialize<CvDocument>(json, JsonOptions)
            ?? throw new InvalidOperationException("cv.json deserialized to null");
        _pdfPath = Path.Combine(dataDir, "cv.pdf");
    }

    public Profile GetProfile() => _cv.Profile;
    public IReadOnlyList<ExperienceEntry> GetExperience() => _cv.Experience;
    public Skills GetSkills() => _cv.Skills;
    public string GetPdfPath() => _pdfPath;
}
