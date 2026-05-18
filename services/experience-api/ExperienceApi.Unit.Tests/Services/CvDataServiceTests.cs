using ExperienceApi.Services;

namespace ExperienceApi.Unit.Tests.Services;

public class CvDataServiceTests
{
    // CvDataService reads from AppContext.BaseDirectory/data/cv.json,
    // which the content link in the .csproj copies to the test output dir.
    private readonly CvDataService _sut = new();

    [Fact]
    public void GetProfile_ReturnsNonNull()
    {
        var profile = _sut.GetProfile();
        Assert.NotNull(profile);
    }

    [Fact]
    public void GetProfile_NameIsNonEmpty()
    {
        Assert.NotEmpty(_sut.GetProfile().Name);
    }

    [Fact]
    public void GetProfile_TaglineIsNonEmpty()
    {
        Assert.NotEmpty(_sut.GetProfile().Tagline);
    }

    [Fact]
    public void GetProfile_YearsOfExperienceIsPositive()
    {
        Assert.True(_sut.GetProfile().YearsOfExperience > 0);
    }

    [Fact]
    public void GetExperience_ReturnsNonEmptyList()
    {
        var list = _sut.GetExperience();
        Assert.NotEmpty(list);
    }

    [Fact]
    public void GetExperience_EachEntryHasRequiredFields()
    {
        foreach (var entry in _sut.GetExperience())
        {
            Assert.NotEmpty(entry.Id);
            Assert.NotEmpty(entry.Title);
            Assert.NotEmpty(entry.Company);
        }
    }

    [Fact]
    public void GetSkills_LanguagesIsNonEmpty()
    {
        Assert.NotEmpty(_sut.GetSkills().Languages);
    }

    [Fact]
    public void GetSkills_CloudIsNonEmpty()
    {
        Assert.NotEmpty(_sut.GetSkills().Cloud);
    }

    [Fact]
    public void GetSkills_AllCategoriesPresent()
    {
        var skills = _sut.GetSkills();
        Assert.NotNull(skills.Languages);
        Assert.NotNull(skills.Cloud);
        Assert.NotNull(skills.Data);
        Assert.NotNull(skills.Ai);
        Assert.NotNull(skills.Leadership);
        Assert.NotNull(skills.Practices);
    }

    [Fact]
    public void GetPdfPath_ReturnsAbsolutePath()
    {
        var path = _sut.GetPdfPath();
        Assert.True(Path.IsPathRooted(path));
        Assert.EndsWith("cv.pdf", path);
    }
}
