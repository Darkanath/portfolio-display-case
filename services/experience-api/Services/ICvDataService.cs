using ExperienceApi.Models;

namespace ExperienceApi.Services;

public interface ICvDataService
{
    Profile GetProfile();
    IReadOnlyList<ExperienceEntry> GetExperience();
    Skills GetSkills();
    IReadOnlyList<MilitaryServiceEntry> GetMilitaryService();
    string GetPdfPath();
}
