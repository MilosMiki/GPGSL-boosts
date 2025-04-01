using System.Net;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text.Json;
using HtmlAgilityPack;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Cors;
using System.Threading.Tasks;
using System.Text;
using System.Diagnostics;
using DotNetEnv;

namespace GrandPrixLoginAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            Env.Load();

            var builder = WebApplication.CreateBuilder(args);
            var corsAllowUrl = Environment.GetEnvironmentVariable("CORS_ALLOW_URL");

            // Add CORS configuration to the services container
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowLocalhost", policy =>
                {
                    
                    // Ensure the environment variable is not null or empty
                    if (!string.IsNullOrEmpty(corsAllowUrl))
                    {
                        // Split the environment variable into multiple URLs if needed (e.g., comma-separated)
                        var allowedOrigins = corsAllowUrl.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);

                        // Set the allowed origins
                        policy.WithOrigins(allowedOrigins);
                    }
                    else
                    {
                        // Fallback to a default origin if the environment variable is not set
                        policy.WithOrigins("https://gpgsl-boosts.vercel.app/", "http://localhost:3000");
                    }
                    policy.AllowAnyMethod();
                    policy.AllowAnyHeader();
                    policy.AllowCredentials();
                });
                /*
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin();
                    policy.AllowAnyMethod();
                    policy.AllowAnyHeader();
                });*/
            });

            var app = builder.Build();
            // Add CORS middleware to your application
            app.UseCors("AllowLocalhost");

            app.MapPost("/login", async (HttpContext context) =>
            {
                // Read the request body as JSON
                var requestBody = await JsonSerializer.DeserializeAsync<LoginRequest>(context.Request.Body);
                if (requestBody == null || string.IsNullOrEmpty(requestBody.Username) || string.IsNullOrEmpty(requestBody.Password))
                {
                    var ress = Results.Json(new { success = false, message = "Missing username or password" }, statusCode: 400);
                    //Console.WriteLine(ress);
                    return ress;
                }

                string loginPageUrl = "https://www.grandprixgames.org/login.php?4";
                string loginPostUrl = "https://www.grandprixgames.org/login.php";

                // Step 1: Create HttpClient with CookieContainer
                var cookieContainer = new CookieContainer();
                var handler = new HttpClientHandler
                {
                    CookieContainer = cookieContainer,
                    AllowAutoRedirect = true
                };
                using var client = new HttpClient(handler);

                // Step 2: Fetch login page
                var response = await client.GetAsync(loginPageUrl);
                if (!response.IsSuccessStatusCode) 
                {
                    var ress = Results.Json(new { success = false, message = "Failed to load login page" });
                    //Console.WriteLine(ress);
                    return ress;
                }

                var html = await response.Content.ReadAsStringAsync();

                // Step 3: Extract posting_token
                var doc = new HtmlDocument();
                doc.LoadHtml(html);
                var tokenNode = doc.DocumentNode.SelectSingleNode("//input[@name='posting_token:login']");
                if (tokenNode == null) 
                {
                    var ress = Results.Json(new { success = false, message = "Failed to retrieve posting_token" });
                    //Console.WriteLine(ress);
                    return ress;
                }

                var postingToken = tokenNode.GetAttributeValue("value", "");

                // Step 4: Submit login form
                var formData = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("username", requestBody.Username),
                    new KeyValuePair<string, string>("password", requestBody.Password), 
                    new KeyValuePair<string, string>("posting_token:login", postingToken), // uniquely generated (by gpg.org) token for each session
                });

                var loginResponse = await client.PostAsync(loginPostUrl, formData);
                if (!loginResponse.IsSuccessStatusCode)
                {
                    var ress = Results.Json(new { success = false, message = "Failed to log in" });
                    //Console.WriteLine(ress);
                    return ress;
                }

                // Step 5: Check if login was successful (adjust as needed based on the actual response)
                var finalHtml = await loginResponse.Content.ReadAsStringAsync();

                // Step 6: Retrieve cookies
                var cookies = cookieContainer.GetCookies(new Uri(loginPostUrl));
                var cookieList = new Dictionary<string, string>();
                foreach (Cookie cookie in cookies)
                {
                    cookieList[cookie.Name] = cookie.Value;
                }
                //Console.WriteLine("User logged in successfully!");
                var res = Results.Json(new { success = true, message = "Login successful", cookies = cookieList });
                //Console.WriteLine(res);
                //return res;
                
                // Step 7: Set headers for GET request
                var user_agent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? 
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
                var accept = context.Request.Headers["Accept"].FirstOrDefault() ?? 
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";

                var cookieName = "phorum_session_v5";
                var cookieEdited = "";
                if (cookieList.ContainsKey(cookieName))
                {
                    cookieEdited = $"phorum_session_v5={cookieList["phorum_session_v5"]}";
                }
                else
                {
                    cookieEdited = $"phorum_session_v5=deleted";
                    Console.WriteLine("Warning: Cookie '{0}' not found. Setting its value to 'deleted'.", cookieName);
                }
                client.DefaultRequestHeaders.Add("User-Agent", user_agent);
                client.DefaultRequestHeaders.Add("Accept", accept);
                client.DefaultRequestHeaders.Add("Cookie", cookieEdited);

                // Step 8: Fetch PMs page
                try
                {
                    var responseGet = await client.GetAsync("https://www.grandprixgames.org/pm.php?4");
                    
                    if (!responseGet.IsSuccessStatusCode)
                    {
                        var resss = Results.Json(new 
                        { 
                            success = false, 
                            message = $"Failed to fetch PM page. Status code: {(int)responseGet.StatusCode}" 
                        }, statusCode: (int)responseGet.StatusCode);
                        //Console.WriteLine(resss);
                        return resss;
                    }

                    var htmlContent = await responseGet.Content.ReadAsStringAsync();

                    // Parse HTML and extract structured data
                    var messages = ParsePmPage(htmlContent);

                    var resultObject = new { success = true, message = messages, cookies = cookieList };
                    //Console.WriteLine(resultObject);
                    var ress = Results.Json(resultObject);
                    var jsonString = JsonSerializer.Serialize(resultObject, new JsonSerializerOptions { WriteIndented = true });
                    //Console.WriteLine(jsonString);
                    return ress;
                }
                catch (Exception ex)
                {
                    var resss = Results.Json(new
                    {
                        success = false,
                        message = $"An error occurred while fetching the PM page: {ex.Message}"
                    }, statusCode: 500);
                    //Console.WriteLine(resss);
                    return resss;
                }
            });

            app.Run();
        }
        private static List<Message> ParsePmPage(string html)
        {
            var messages = new List<Message>();
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            foreach (var row in doc.DocumentNode.SelectNodes("//tr"))
            {
                var checkboxNode = row.SelectSingleNode(".//input[@type='checkbox']");
                var linkNode = row.SelectSingleNode(".//td[2]/a");
                var senderNode = row.SelectSingleNode(".//td[3]/a");
                var dateNode = row.SelectSingleNode(".//td[4]");

                if (checkboxNode != null && linkNode != null && senderNode != null && dateNode != null)
                {
                    messages.Add(new Message
                    {
                        Id = checkboxNode.GetAttributeValue("value", ""),
                        Title = linkNode.InnerText.Trim(),
                        Sender = senderNode.InnerText.Trim(),
                        Date = dateNode.InnerText.Trim()
                    });
                }
            }

            return messages;
        }
    }
    class Message
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Sender { get; set; }
        public string Date { get; set; }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class PmPageRequest
    {
        public string UserAgent { get; set; } = "";
        public string Accept { get; set; } = "";
        public string Cookie { get; set; } = "";
    }
}