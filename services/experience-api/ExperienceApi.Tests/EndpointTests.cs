using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ExperienceApi.Tests;

public class EndpointTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static readonly Regex SemverPattern =
        new(@"^\d+\.\d+\.\d+$", RegexOptions.Compiled);

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var resp = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Health_BodyHasStatusOk()
    {
        var resp = await _client.GetAsync("/health");
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", doc.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Health_BodyHasServiceName()
    {
        var resp = await _client.GetAsync("/health");
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("experience-api", doc.GetProperty("service").GetString());
    }

    [Fact]
    public async Task Health_BodyHasVersion()
    {
        var resp = await _client.GetAsync("/health");
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(doc.GetProperty("version").GetString()));
    }

    [Fact]
    public async Task Version_ReturnsOk()
    {
        var resp = await _client.GetAsync("/version");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Version_IsSemver()
    {
        var resp = await _client.GetAsync("/version");
        var text = (await resp.Content.ReadAsStringAsync()).Trim();
        Assert.Matches(SemverPattern, text);
    }

    [Fact]
    public async Task Profile_ReturnsOk()
    {
        var resp = await _client.GetAsync("/profile");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Profile_HasRequiredFields()
    {
        var resp = await _client.GetAsync("/profile");
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(doc.TryGetProperty("name", out _), "missing 'name'");
        Assert.True(doc.TryGetProperty("tagline", out _), "missing 'tagline'");
        Assert.True(doc.TryGetProperty("summary", out _), "missing 'summary'");
        Assert.True(doc.TryGetProperty("yearsOfExperience", out _), "missing 'yearsOfExperience'");
    }

    [Fact]
    public async Task Experience_ReturnsOk()
    {
        var resp = await _client.GetAsync("/experience");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Experience_ReturnsNonEmptyArray()
    {
        var resp = await _client.GetAsync("/experience");
        var arr = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, arr.ValueKind);
        Assert.True(arr.GetArrayLength() > 0);
    }

    [Fact]
    public async Task Experience_EachItemHasRequiredFields()
    {
        var resp = await _client.GetAsync("/experience");
        var arr = await resp.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var item in arr.EnumerateArray())
        {
            Assert.True(item.TryGetProperty("id", out _), "item missing 'id'");
            Assert.True(item.TryGetProperty("title", out _), "item missing 'title'");
            Assert.True(item.TryGetProperty("company", out _), "item missing 'company'");
        }
    }

    [Fact]
    public async Task Skills_ReturnsOk()
    {
        var resp = await _client.GetAsync("/skills");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Skills_HasExpectedCategories()
    {
        var resp = await _client.GetAsync("/skills");
        var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Object, doc.ValueKind);
        foreach (var category in new[] { "languages", "cloud", "data", "ai", "leadership", "practices" })
        {
            Assert.True(doc.TryGetProperty(category, out _), $"missing category '{category}'");
        }
    }
}
