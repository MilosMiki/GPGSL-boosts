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
using System.Net.Http.Headers;

namespace GrandPrixLoginAPI
{
    public class Program
    {
        public static string globalMessageBody = "";
        private static async Task<Microsoft.AspNetCore.Http.IResult> loadPms(HttpClient client, HttpContext context, CookieCollection cookies, string targetUrl = "https://www.grandprixgames.org/pm.php?4", string username="GPGSL"){
            
            var cookieList = new Dictionary<string, string>();
            foreach (Cookie cookie in cookies)
            {
                //Console.WriteLine("Found Cookie!");
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
                
                // Set the cookie in the HTTP response to make it persistent
                context.Response.Cookies.Append(
                    cookieName, 
                    cookieList[cookieName],
                    new CookieOptions
                    {
                        HttpOnly = true,       // Prevent JavaScript access (security)
                        Secure = true,         // Only send over HTTPS
                        Expires = DateTime.UtcNow.AddDays(60), // Persist for 7 days
                        SameSite = SameSiteMode.None,
                        // Domain = "yourdomain.com" // Uncomment if needed
                    }
                );
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
                var responseGet = await client.GetAsync(targetUrl);
                
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
                if (targetUrl != "https://www.grandprixgames.org/pm.php?4" && targetUrl != "https://www.grandprixgames.org/pm.php?4,page=list,folder_id=outbox")
                // if it is neither the inbox page or the "Sent" page
                {
                    var messages = htmlContent;
                    globalMessageBody = htmlContent; // using this to avoid changing return type of function (don't like it very much)
                    var resultObject = new { success = true, message = messages, cookies = cookieList };
                    //Console.WriteLine(resultObject);
                    var ress = Results.Json(resultObject);
                    var jsonString = JsonSerializer.Serialize(resultObject, new JsonSerializerOptions { WriteIndented = true });
                    //Console.WriteLine(jsonString);
                    return ress;

                }
                else
                {
                    var messages = await ParsePmPage(htmlContent, client, context, cookies, username);
                    var resultObject = new { success = true, message = messages, cookies = cookieList };
                    //Console.WriteLine(resultObject);
                    var ress = Results.Json(resultObject);
                    var jsonString = JsonSerializer.Serialize(resultObject, new JsonSerializerOptions { WriteIndented = true });
                    //Console.WriteLine(jsonString);
                    return ress;
                }
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
        }
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
                        policy.WithOrigins("https://gpgsl-boosts.vercel.app", "https://four-step-boost.vercel.app", "http://localhost:3000", "http://localhost:5173");
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

            app.MapMethods("{*path}", new[] { "OPTIONS" }, () => Results.Ok());
            /*
            app.Use(async (context, next) =>
            {
                Console.WriteLine("Incoming request: " + context.Request.Path);
                await next.Invoke();
                Console.WriteLine("Outgoing response headers:");
                foreach (var header in context.Response.Headers)
                {
                    Console.WriteLine($"{header.Key}: {header.Value}");
                }
            });*/

            
            app.MapPost("/login/get-pm-page", async (HttpContext context) =>
            {
                try
                {
                    // 1. Parse login credentials
                    var loginRequest = await context.Request.ReadFromJsonAsync<LoginRequest>();
                    if (loginRequest == null || string.IsNullOrEmpty(loginRequest.Username) || string.IsNullOrEmpty(loginRequest.Password))
                    {
                        return Results.Json(new { success = false, message = "Username and password are required" }, statusCode: 400);
                    }

                    // 2. Initialize HttpClient with cookie handling
                    var cookieContainer = new CookieContainer();
                    var handler = new HttpClientHandler { CookieContainer = cookieContainer };
                    using var client = new HttpClient(handler);
                    
                    // 3. First fetch login page to get CSRF token
                    var loginPageUrl = "https://www.grandprixgames.org/login.php?4";
                    var loginResponse = await client.GetAsync(loginPageUrl);
                    if (!loginResponse.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false, message = "Failed to load login page" }, statusCode: (int)loginResponse.StatusCode);
                    }

                    var loginHtml = await loginResponse.Content.ReadAsStringAsync();
                    var doc = new HtmlDocument();
                    doc.LoadHtml(loginHtml);
                    
                    var tokenNode = doc.DocumentNode.SelectSingleNode("//input[@name='posting_token:login']");
                    if (tokenNode == null)
                    {
                        return Results.Json(new { success = false, message = "Could not find CSRF token in login page" });
                    }
                    var csrfToken = tokenNode.GetAttributeValue("value", "");

                    // 4. Perform login
                    var formData = new FormUrlEncodedContent(new[]
                    {
                        new KeyValuePair<string, string>("username", loginRequest.Username),
                        new KeyValuePair<string, string>("password", loginRequest.Password),
                        new KeyValuePair<string, string>("posting_token:login", csrfToken)
                    });

                    var postLoginResponse = await client.PostAsync("https://www.grandprixgames.org/login.php", formData);
                    if (!postLoginResponse.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false, message = "Login failed" }, statusCode: (int)postLoginResponse.StatusCode);
                    }

                    // 5. Now fetch PM form page
                    var pmFormUrl = "https://www.grandprixgames.org/pm.php?4,page=send";
                    var pmFormResponse = await client.GetAsync(pmFormUrl);
                    if (!pmFormResponse.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false, message = "Failed to load PM form" }, statusCode: (int)pmFormResponse.StatusCode);
                    }

                    var pmFormHtml = await pmFormResponse.Content.ReadAsStringAsync();
                    doc.LoadHtml(pmFormHtml);

                    // 6. Extract required fields from PM form
                    var pmTokenNode = doc.DocumentNode.SelectSingleNode("//input[@name='posting_token:pm']");
                    var spamHurdleNode = doc.DocumentNode.SelectSingleNode("//input[@name='spamhurdles_pm']");
                    
                    if (pmTokenNode == null || spamHurdleNode == null)
                    {
                        return Results.Json(new { success = false, message = "Incorrect username/password" });
                    }

                    // 7. Get session cookie to return to client
                    var sessionCookie = cookieContainer.GetCookies(new Uri("https://www.grandprixgames.org"))
                        .FirstOrDefault(c => c.Name == "phorum_session_v5");

                    if (sessionCookie == null)
                    {
                        return Results.Json(new { success = false, message = "Session cookie not found after login" });
                    }

                    // 8. Persist session cookie for subsequent authenticated endpoints
                    // NOTE: Frontend cannot set a cookie for this API domain itself. We must issue Set-Cookie here.
                    var cookieExpiry = sessionCookie.Expires < DateTime.UtcNow.AddMinutes(5)
                        ? DateTime.UtcNow.AddDays(60) // fallback if upstream cookie has no meaningful expiry
                        : sessionCookie.Expires;

                    // In local dev over HTTP, do not mark Secure and prefer Lax to ensure the cookie is sent
                    var isLocal = string.Equals(context.Request.Host.Host, "localhost", StringComparison.OrdinalIgnoreCase);
                    var cookieOptions = new CookieOptions
                    {
                        HttpOnly = true,
                        Secure = !isLocal && context.Request.IsHttps,
                        Expires = cookieExpiry,
                        SameSite = isLocal ? SameSiteMode.Lax : SameSiteMode.None
                    };

                    context.Response.Cookies.Append(
                        "phorum_session_v5",
                        sessionCookie.Value,
                        cookieOptions
                    );

                    // 9. Return success with all needed data (also echo cookie info)
                    return Results.Json(new
                    {
                        success = true,
                        posting_token = pmTokenNode.GetAttributeValue("value", ""),
                        spamhurdles_pm = spamHurdleNode.GetAttributeValue("value", ""),
                        forum_id = "4", // Constant from the form
                        session_cookie = sessionCookie.Value,
                        cookie_expires = cookieExpiry.ToString("o")
                    });
                }
                catch (Exception ex)
                {
                    return Results.Json(new { success = false, message = ex.Message }, statusCode: 500);
                }
            });

            app.MapPost("/login/send-pm", async (HttpContext context) =>
            {
                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
                
                try
                {
                    // 1. Read as form data
                    var form = await context.Request.ReadFormAsync();
                    //logger.LogInformation("Received form data: {@FormData}", form);

                    // 2. Validate we have a session cookie
                    if (!form.TryGetValue("session_cookie", out var sessionCookie) || string.IsNullOrEmpty(sessionCookie))
                    {
                        return Results.Json(new { success = false, message = "Missing session cookie" }, statusCode: 400);
                    }

                    // 3. Initialize HttpClient with EXACT same cookies as browser would have
                    var cookieContainer = new CookieContainer();
                    var handler = new HttpClientHandler { 
                        CookieContainer = cookieContainer,
                        UseCookies = true,
                        AllowAutoRedirect = false // Important to see actual response
                    };
                    
                    // Add ALL required cookies exactly as the website expects
                    cookieContainer.Add(new Uri("https://www.grandprixgames.org"), 
                        new Cookie("phorum_session_v5", sessionCookie));
                    cookieContainer.Add(new Uri("https://www.grandprixgames.org"),
                        new Cookie("help", "true")); // Often required by the site

                    using var client = new HttpClient(handler);
                    client.DefaultRequestHeaders.Add("User-Agent", 
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36");
                    
                    // 4. Prepare EXACT form data as the website expects
                    var postData = new Dictionary<string, string>
                    {
                        ["forum_id"] = "4",
                        ["posting_token:pm"] = form["posting_token:pm"]!,
                        ["action"] = "post",
                        ["to_name"] = form["to_name"]!,
                        ["recipients[" + form["recipients"] + "]"] = "1",
                        ["subject"] = form["subject"]!,
                        ["message"] = form["message"]!,
                        ["spamhurdles_pm"] = form["spamhurdles_pm"]!,
                        ["keep"] = "1",
                        ["post"] = "Send PM"
                    };

                    // 5. Send to target website with EXACT content type
                    var content = new FormUrlEncodedContent(postData);
                    content.Headers.ContentType = new MediaTypeHeaderValue("application/x-www-form-urlencoded");

                    var response = await client.PostAsync(
                        "https://www.grandprixgames.org/pm.php?4,page=send", // Note the exact URL with parameters
                        content
                    );

                    // 6. Check for successful PM sent (either redirect or direct response)
                    var responseContent = await response.Content.ReadAsStringAsync();
                    
                    if (response.StatusCode == HttpStatusCode.Redirect)
                    {
                        if (response.Headers.Location?.ToString().Contains("okmsg=PMSent") == true)
                        {
                            return Results.Json(new { success = true });
                        }
                    }
                    else if (responseContent.Contains("Private message sent"))
                    {
                        return Results.Json(new { success = true });
                    }

                    // 7. Detailed error analysis
                    logger.LogError("PM send failed. Status: {StatusCode}, Response: {Content}", 
                        response.StatusCode, responseContent);
                    
                    return Results.Json(new { 
                        success = false,
                        status = (int)response.StatusCode,
                        message = "Too fast - try again in 5 seconds",
                        response = responseContent.Length > 500 ? responseContent.Substring(0, 500) + "..." : responseContent
                    });
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error sending PM");
                    return Results.Json(new { 
                        success = false, 
                        message = ex.Message,
                        stackTrace = ex.StackTrace
                    }, statusCode: 500);
                }
            });

            app.MapGet("/login/check-session", async (HttpContext context) =>
            {
                //Console.WriteLine("Finding auto-login");
                // Check if the session cookie exists
                var phorumSessionCookie = context.Request.Cookies["phorum_session_v5"];
                if (string.IsNullOrEmpty(phorumSessionCookie))
                {
                    //Console.WriteLine("Did not find cookie :(");
                    return Results.Json(new { success = false, message = "Did not find cookie." });
                }

                // Create cookie container and add our cookie
                var cookieContainer = new CookieContainer();
                var uri = new Uri("https://www.grandprixgames.org");
                cookieContainer.Add(uri, new Cookie("phorum_session_v5", phorumSessionCookie));
                
                // Get the CookieCollection from the container
                var cookieCollection = cookieContainer.GetCookies(uri);
                //Console.WriteLine(cookieCollection);

                var handler = new HttpClientHandler
                {
                    CookieContainer = cookieContainer,
                    AllowAutoRedirect = true
                };
                
                using var client = new HttpClient(handler);
                var username = context.Request.Headers["X-Username"].FirstOrDefault();
                //Console.WriteLine("Username is: "+username);
                
                if (username?.ToUpper() == "GPGSL")
                {
                    return await loadPms(client, context, cookieCollection, "https://www.grandprixgames.org/pm.php?4", "GPGSL");
                }
                else
                {
                    return await loadPms(client, context, cookieCollection, "https://www.grandprixgames.org/pm.php?4,page=list,folder_id=outbox", username ?? "");
                }
                /*
                try
                {
                    var response = await client.GetAsync("https://www.grandprixgames.org/pm.php?4");
                    if (!response.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false });
                    }

                    var htmlContent = await response.Content.ReadAsStringAsync();
                    var messages = ParsePmPage(htmlContent);
                    return Results.Json(new { success = true, message = messages, cookies = cookieContainer });
                }
                catch
                {
                    return Results.Json(new { success = false });
                }*/
            });

            app.MapGet("/boost-announcement", async (HttpContext context) =>
            {
                try
                {
                    using var client = new HttpClient();
                    
                    // Set headers to mimic a browser request
                    var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ??
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";
                    var accept = context.Request.Headers["Accept"].FirstOrDefault() ??
                        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8";
                    
                    client.DefaultRequestHeaders.Add("User-Agent", userAgent);
                    client.DefaultRequestHeaders.Add("Accept", accept);

                    // Fetch the GPGSL search page
                    var response = await client.GetAsync("https://www.grandprixgames.org/search.php?107,search=,author=GPGSL,page=1,match_type=ALL,match_dates=365,match_forum=4,match_threads=0");
                    
                    if (!response.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false, message = "Failed to fetch boost announcement" });
                    }

                    var htmlContent = await response.Content.ReadAsStringAsync();
                    
                    // Parse the HTML to find boost announcements
                    var doc = new HtmlDocument();
                    doc.LoadHtml(htmlContent);
                    
                    // Find all search results
                    var searchResults = doc.DocumentNode.SelectNodes("//div[@class='search-result']");
                    
                    if (searchResults == null)
                    {
                        return Results.Json(new { success = false, message = "No search results found" });
                    }
                    
                    // Check first two posts for boost announcements
                    for (int i = 0; i < Math.Min(2, searchResults.Count); i++)
                    {
                        var result = searchResults[i];
                        var blockquote = result.SelectSingleNode(".//blockquote");
                        
                        if (blockquote != null)
                        {
                            var text = blockquote.InnerText.Trim();
                            //Console.WriteLine($"Checking post {i + 1}: {text.Substring(0, Math.Min(100, text.Length))}...");
                            
                            if (text.Contains("Boost Announcement"))
                            {
                                //Console.WriteLine("Found Boost Announcement!");
                                // Look for "Round ##" pattern
                                var roundMatch = System.Text.RegularExpressions.Regex.Match(text, @"Round (\d+):");
                                if (roundMatch.Success)
                                {
                                    var roundNumber = roundMatch.Groups[1].Value;
                                    var roundTextMatch = System.Text.RegularExpressions.Regex.Match(text, @"Round \d+: ([^-]+)");
                                    var roundName = roundTextMatch.Success ? roundTextMatch.Groups[1].Value.Trim() : "";
                                    
                                    //Console.WriteLine($"Found Round {roundNumber}: {roundName}");
                                    return Results.Json(new { 
                                        success = true, 
                                        message = $"Round {roundNumber} - {roundName}" 
                                    });
                                }
                            }
                        }
                    }
                    
                    return Results.Json(new { success = false, message = "Boost post not found" });
                }
                catch (Exception ex)
                {
                    return Results.Json(new { success = false, message = $"Error: {ex.Message}" });
                }
            });

            app.MapGet("/login/get-boost-counts", async (HttpContext context) =>
            {
                // Check if the session cookie exists
                var phorumSessionCookie = context.Request.Cookies["phorum_session_v5"];
                if (string.IsNullOrEmpty(phorumSessionCookie))
                {
                    return Results.Json(new { success = false, message = "No session cookie found" });
                }

                // Create cookie container and add our cookie
                var cookieContainer = new CookieContainer();
                var uri = new Uri("https://www.grandprixgames.org");
                cookieContainer.Add(uri, new Cookie("phorum_session_v5", phorumSessionCookie));

                var handler = new HttpClientHandler
                {
                    CookieContainer = cookieContainer,
                    AllowAutoRedirect = true
                };

                using var client = new HttpClient(handler);

                try
                {
                    // Fetch the sent folder (outbox)
                    var response = await client.GetAsync("https://www.grandprixgames.org/pm.php?4,page=list,folder_id=outbox");
                    if (!response.IsSuccessStatusCode)
                    {
                        return Results.Json(new { success = false, message = "Failed to fetch sent messages" });
                    }

                    var htmlContent = await response.Content.ReadAsStringAsync();

                    // Parse HTML to extract sent messages
                    var doc = new HtmlDocument();
                    doc.LoadHtml(htmlContent);

                    int driverBoostCount = 0;
                    int teamBoostCount = 0;
                    var raceBoosts = new Dictionary<string, List<string>>(); // venue -> list of boost types

                    foreach (var row in doc.DocumentNode.SelectNodes("//tr") ?? Enumerable.Empty<HtmlNode>())
                    {
                        var linkNode = row.SelectSingleNode(".//td[2]/a");
                        if (linkNode != null)
                        {
                            var messageTitle = linkNode.InnerText.Trim();
                            var messageTitleLower = messageTitle.ToLower();
                            
                            // Check if it's a boost message
                            if (messageTitleLower.Contains("boost"))
                            {
                                string? boostType = null;
                                
                                if (messageTitleLower.Contains("driver boost"))
                                {
                                    driverBoostCount++;
                                    boostType = "driver";
                                }
                                else if (messageTitleLower.Contains("team boost"))
                                {
                                    teamBoostCount++;
                                    boostType = "team";
                                }
                                else if (!messageTitleLower.Contains("single") && !messageTitleLower.Contains("double"))
                                {
                                    // Assume it's a driver boost if it doesn't say "team" or have single/double keywords
                                    driverBoostCount++;
                                    boostType = "driver";
                                }

                                // Extract venue from message title
                                // Format: "Driver Boost - [Name] - [Venue] - [Track]" or "Team Boost - [Team] - [Venue] - [Track] - [Type]"
                                if (boostType != null)
                                {
                                    var parts = messageTitle.Split('-').Select(p => p.Trim()).ToArray();
                                    if (parts.Length >= 3)
                                    {
                                        // The venue should be the 3rd part (index 2)
                                        var venue = parts[2];
                                        
                                        if (!raceBoosts.ContainsKey(venue))
                                        {
                                            raceBoosts[venue] = new List<string>();
                                        }
                                        
                                        if (!raceBoosts[venue].Contains(boostType))
                                        {
                                            raceBoosts[venue].Add(boostType);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    return Results.Json(new { 
                        success = true, 
                        driverBoostCount = driverBoostCount,
                        teamBoostCount = teamBoostCount,
                        raceBoosts = raceBoosts
                    });
                }
                catch (Exception ex)
                {
                    return Results.Json(new { success = false, message = $"Error: {ex.Message}" });
                }
            });

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

                if (requestBody.Username?.ToUpper() == "GPGSL")
                {
                    return await loadPms(client, context, cookies, "https://www.grandprixgames.org/pm.php?4", "GPGSL");
                }
                else
                {
                    return await loadPms(client, context, cookies, "https://www.grandprixgames.org/pm.php?4,page=list,folder_id=outbox", requestBody.Username ?? "");
                }
            });

            app.Run();
        }
        private static async Task<List<Message>> ParsePmPage(string html, HttpClient client, HttpContext context, CookieCollection cookies, string username = "GPGSL")
        {
            var messages = new List<Message>();
            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            foreach (var row in doc.DocumentNode.SelectNodes("//tr"))
            {
                var checkboxNode = row.SelectSingleNode(".//input[@type='checkbox']");
                var linkNode = row.SelectSingleNode(".//td[2]/a");
                var senderNode = row.SelectSingleNode(".//td[3]/a");
                var dateNode = username?.ToUpper() == "GPGSL" ? row.SelectSingleNode(".//td[4]") : row.SelectSingleNode(".//td[5]");
                //Console.WriteLine(row.SelectSingleNode(".//td[5]").InnerText.Trim());

                if (checkboxNode != null && linkNode != null && senderNode != null && dateNode != null)
                {
                    var messageId = checkboxNode.GetAttributeValue("value", "");
                    var messageTitle = linkNode.InnerText.Trim();
                    // load message body (very slow)
                    var bodyContent = "";
                    if (!string.IsNullOrEmpty(messageTitle) &&
                        messageTitle.IndexOf("boost", StringComparison.OrdinalIgnoreCase) >= 0 && // is a boost
                        messageTitle.IndexOf("single", StringComparison.OrdinalIgnoreCase) == -1 &&
                        messageTitle.IndexOf("double", StringComparison.OrdinalIgnoreCase) == -1 &&
                        messageTitle.IndexOf("driver", StringComparison.OrdinalIgnoreCase) == -1) // is not a driver boost
                    {
                        await loadPms(client, context, cookies, "https://www.grandprixgames.org/pm.php?4,page=read,folder_id=inbox,pm_id=" + messageId);
                        var messageDoc = new HtmlDocument();
                        messageDoc.LoadHtml(globalMessageBody);
                        var messageBodyNode = messageDoc.DocumentNode.SelectSingleNode("//div[@class='message-body']");
                        //var foundIdNode = doc.DocumentNode.SelectSingleNode("//input[@name='pm_id']");
                        //string foundId = foundIdNode.GetAttributeValue("value", "");
                        bodyContent = messageBodyNode?.InnerText.Trim() ?? string.Empty;
                    }

                    messages.Add(new Message
                    {
                        Id = messageId,
                        Title = messageTitle,
                        Sender = senderNode.InnerText.Trim(),
                        Date = dateNode.InnerText.Trim(),
                        Body = bodyContent
                    });
                }
            }

            return messages;
        }
    }
    class Message
    {
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
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

    public record SendPmRequest(
        string To,
        string RecipientId,
        string Subject,
        string Message,
        string PostingToken,
        string SpamHurdlesPm,
        string SessionCookie,
        string? ForumId = null,
        bool KeepCopy = true
    );
}