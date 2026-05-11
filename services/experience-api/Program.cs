using System.Text.Json;
using System.Text.Json.Serialization;

const string ServiceName = "experience-api";
const string ServiceVersion = "0.1.0";

var builder = WebApplication.CreateSlimBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS")
            ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            ?? ["http://localhost:5173"];
        policy.WithOrigins(allowedOrigins)
              .WithHeaders("Content-Type")
              .WithMethods("GET");
    });
});

var app = builder.Build();

app.UseCors();

// Load CV data once at startup. The file is baked into the image.
var dataPath = Path.Combine(AppContext.BaseDirectory, "data", "cv.json");
var cvJson = File.ReadAllText(dataPath);
var cvData = JsonSerializer.Deserialize<JsonElement>(cvJson);

app.MapGet("/health", () => Results.Ok(new
{
    status = "ok",
    service = ServiceName,
    version = ServiceVersion
}));

app.MapGet("/version", () => Results.Text(ServiceVersion));

app.MapGet("/experience", () =>
{
    if (cvData.TryGetProperty("experience", out var experience))
        return Results.Json(experience);
    return Results.NotFound();
});

app.MapGet("/skills", () =>
{
    if (cvData.TryGetProperty("skills", out var skills))
        return Results.Json(skills);
    return Results.NotFound();
});

app.MapGet("/profile", () =>
{
    if (cvData.TryGetProperty("profile", out var profile))
        return Results.Json(profile);
    return Results.NotFound();
});

app.MapGet("/cv-pdf", () =>
{
    var pdfPath = Path.Combine(AppContext.BaseDirectory, "data", "cv.pdf");
    if (!File.Exists(pdfPath))
        return Results.NotFound("CV PDF not bundled in this image yet.");
    return Results.File(pdfPath, "application/pdf", "Tal_Shterzer_CV.pdf");
});

app.Run();

// Expose Program to the test project via WebApplicationFactory<Program>
public partial class Program { }
