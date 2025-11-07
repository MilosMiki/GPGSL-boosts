# GPGSL Boosts Tracking Application Documentation

## Overview

The GPGSL Boosts Tracking Application is a comprehensive web-based system designed to manage and track player boosts for the Grand Prix Games forum game. The application consists of three main components:

1. **Main Admin Application** (`grandprix-login-client`) - A React-based web application for administrators and players to view boost submissions
2. **Boost Submission App** (`gpgsl-two-step-boost`) - A streamlined React application for players to submit boosts
3. **Backend API** (`grandprix-login-server`) - A .NET Core Web API that handles authentication and communication with the external forum

## Architecture

### Technology Stack
- **Frontend**: React 19.0.0 with TypeScript (Two-Step Boost), React 19.0.0 with JavaScript (Main App)
- **Backend**: .NET 9.0 Web API
- **Database**: Firebase Firestore
- **Authentication**: Session-based authentication with grandprixgames.org forum
- **Deployment**: Vercel (Frontend), Azure/Cloud (Backend)

### Application Structure
```
GPGSL boosts .net/
├── grandprix-login-client/     # Main admin/player application
├── gpgsl-two-step-boost/       # Boost submission application  
└── grandprix-login-server/     # .NET Web API backend
```

## Core Features

### 1. Administrator Login (GPGSL User)
- **Purpose**: Allows administrators to view all boost submissions and manage the system
- **Authentication**: Uses GPGSL forum credentials to authenticate with grandprixgames.org
- **Capabilities**: 
  - View all boost submissions (matched, unmatched, invalid, other)
  - Manage drivers and teams database
  - Add new events to calendar
  - Copy data to clipboard for Excel integration
  - Refresh forum messages and database

### 2. Boost Data Processing and Categorization
The system processes boost submissions and categorizes them into four distinct tables:

#### **Matched Boosts** (Correctly Formatted)
- Boosts that are properly formatted and successfully matched to drivers/teams
- Displayed in the main lineup table with boost values (200 for drivers, 4/8 for teams)
- Includes duplicate detection and warning system
- **Activity Status**: Shows activity requirement compliance for each player

#### **Unmatched Boosts** 
- Boosts detected as valid submissions but unable to match driver/team data
- Common reasons: incorrect username, driver/team not found in database
- Provides detailed error messages for troubleshooting

#### **Invalid Boosts** (After Deadline)
- Boosts submitted after the deadline (typically 20:00 on boost deadline date)
- Automatically filtered out from valid submissions
- Displayed in separate table with submission timestamps

#### **Other Messages**
- Non-boost messages that contain venue information
- Helps administrators identify irrelevant communications

### 3. Advanced Filtering System
- **Event Filtering**: Filter boosts by specific Grand Prix events
- **Date Filtering**: Set custom deadline dates for boost validation
- **Driver Type Filtering**: 
  - Race drivers (positions 1-2)
  - Test drivers (positions 3+)
  - Test (full grid) mode - includes race drivers when test drivers are missing
- **Team Filtering**: Separate team boost tracking

### 4. Clipboard Integration
- **Copy Table to Clipboard**: Complete lineup data in tab-separated format for Excel
- **Copy Drivers Only**: Driver-specific data for separate analysis
- **Copy Teams Only**: Team-specific data for separate analysis
- **List All Boosts**: Formatted text output for forum posting

### 5. Database Management
- **Teams Database**: Manage team information including:
  - Team names and usernames
  - Short names (short1, short2) for alternative identification
  - Automatic ID generation and sorting
- **Drivers Database**: Manage driver information including:
  - Driver names, usernames, and team associations
  - Automatic team-based ID generation
  - Support for race and test driver positions

### 6. Player Login and Boost Submission
- **Forum Authentication**: Secure login using grandprixgames.org credentials
- **Player Detection**: Automatic detection of whether user is a registered driver or team owner
- **Boost Type Selection**:
  - Driver boosts (200 points)
  - Team boosts with single (4 points) or double (8 points) options
- **Event Selection**: Manual race selection or automatic current GP detection

### 7. Automatic Event Detection
- **Forum Integration**: Scans GPGSL posts for boost announcements
- **Round Detection**: Automatically identifies current Grand Prix round
- **Smart Defaults**: Auto-selects most recent event for boost submissions

### 8. Direct Message System
- **Automatic PM Sending**: Sends properly formatted boost messages to GPGSL
- **Message Templates**: Standardized boost message format
- **Confirmation System**: Provides submission confirmation and error handling
- **Copy Retention**: Ensures "Keep A Copy In My Sent Items" is enabled

### 9. Boost Status Checking
- **Sent Folder Reading**: For regular users, checks sent messages for boost submissions
- **Received Folder Reading**: For GPGSL account, reads received boost messages
- **Status Verification**: Allows users to verify their boost submission status

### 10. Warning System Integration
- **Activity Tracking**: Integrates with forum activity check system
- **Warning Penalties**: 
  - 1 warning: 10 points (teams), 20 points (drivers)
  - 2 warnings: 25 points (teams), 40 points (drivers)
  - 3+ warnings: Disqualification
- **Visual Indicators**: Red highlighting for users with warnings

### 11. Activity Requirement Tracking (Admin Feature)
- **Forum Activity Rule**: Players must post at least once between two events to remain eligible
- **External Database Integration**: Connects to separate activity tracking database
- **Real-time Display**: Activity status shown directly in the matched boosts table
- **Automatic Validation**: System checks activity requirements when processing boosts
- **Warning Integration**: Activity violations contribute to the overall warning system

## Technical Implementation

### Backend API Endpoints

#### Authentication Endpoints
- `POST /login` - Authenticate with grandprixgames.org forum
- `POST /login/get-pm-page` - Get PM form data for boost submission
- `POST /login/send-pm` - Send boost message to GPGSL
- `GET /login/check-session` - Validate existing session

#### Data Endpoints
- `GET /boost-announcement` - Fetch current boost announcement from forum

### Database Schema (Firebase Firestore)

#### Collections
- **teams**: Team information with ID, name, username, short1, short2
- **drivers**: Driver information with ID, name, username, team
- **calendar**: Event information with ID, venue, track, country
- **warnings**: Warning data with notPosted and total documents

### Boost Processing Logic

#### Message Parsing
1. **HTML Decoding**: Decodes HTML entities in message titles
2. **Title Processing**: Standardizes boost message formats
3. **Venue Matching**: Matches venue information with calendar events
4. **Date Validation**: Checks submission against deadline (20:00 cutoff)
5. **Driver/Team Matching**: Matches usernames with database entries
6. **Boost Type Detection**: Identifies single/double team boosts
7. **Activity Validation**: Checks activity requirements from external database

#### Validation Rules
- Driver boosts: Must match driver username and contain venue information
- Team boosts: Must match team username and specify single/double type
- Deadline validation: Messages after 20:00 on deadline date are invalid
- Duplicate detection: Prevents multiple boosts from same user
- Activity requirement: Players must have posted between events to be eligible

### Security Features
- **CORS Configuration**: Configurable allowed origins for API access
- **Session Management**: Secure cookie handling with proper expiration
- **Input Validation**: Comprehensive validation of all user inputs
- **Error Handling**: Detailed error messages without exposing sensitive information

## User Interface Features

### Main Application Interface
- **Sidebar Calendar**: Event selection with admin editing capabilities
- **Main Content Area**: Boost lineup table with filtering options and activity status
- **Side Tables**: Unmatched, invalid, and other message displays
- **Copy Buttons**: Multiple clipboard integration options
- **Help System**: Contextual help overlay for first-time users

### Boost Submission Interface
- **Multi-Step Wizard**: Guided boost submission process
- **Progress Indicator**: Visual progress bar through submission steps
- **Auto-Detection**: Smart defaults for current GP and user roles
- **Confirmation Screen**: Final review before submission

### Responsive Design
- **Mobile Compatibility**: Responsive design for various screen sizes
- **Accessibility**: Proper labeling and keyboard navigation support
- **Visual Feedback**: Clear success/error states and loading indicators

## Deployment and Configuration

### Environment Variables
- **API Base URL**: Backend service endpoint configuration
- **Firebase Config**: Database connection and authentication
- **CORS Settings**: Cross-origin request configuration

### Build Process
- **Frontend**: Vite-based build system for React applications
- **Backend**: .NET 9.0 build and deployment
- **Database**: Firebase Firestore with automatic scaling

## Usage Workflows

### Administrator Workflow
1. Login with GPGSL credentials
2. Select event from calendar
3. Set boost deadline date
4. Review matched boosts in main table (including activity status)
5. Check unmatched boosts for manual processing
6. Copy data to clipboard for Excel integration
7. Manage drivers/teams database as needed
8. Monitor activity compliance for all players

### Player Workflow
1. Login with personal forum credentials
2. System detects player role (driver/team owner)
3. Select boost type and amount (for teams)
4. Choose event (manual or auto-detected)
5. Review and confirm boost details
6. Submit boost message to GPGSL
7. Receive confirmation of successful submission

### Boost Verification Workflow
1. Login with personal credentials
2. Select appropriate event and deadline
3. View boost status in lineup table
4. Check unmatched/invalid tables if boost not found
5. Verify submission timestamp and format
6. Confirm activity requirement compliance

## Error Handling and Troubleshooting

### Common Issues
- **Login Failures**: Incorrect credentials or forum connectivity issues
- **Boost Not Found**: Check unmatched boosts table for error details
- **Duplicate Boosts**: System prevents multiple submissions with clear indicators
- **Deadline Issues**: Invalid boosts clearly marked with submission timestamps
- **Activity Violations**: Players who haven't met posting requirements are flagged

### Debugging Features
- **Console Logging**: Detailed boost processing logs for administrators
- **Error Messages**: Specific error descriptions for troubleshooting
- **Refresh Options**: Manual refresh of forum data and database
- **Status Indicators**: Clear visual feedback for all system states
- **Activity Monitoring**: Real-time activity requirement status

## Future Enhancements

### Potential Improvements
- **Real-time Updates**: WebSocket integration for live boost tracking
- **Advanced Analytics**: Detailed boost statistics and trends
- **Mobile App**: Native mobile application for boost submission
- **Automated Notifications**: Email/SMS alerts for boost deadlines and activity requirements
- **Enhanced Reporting**: Advanced Excel export options with formatting
- **Activity Dashboard**: Dedicated interface for monitoring player activity compliance

---

This documentation provides a comprehensive overview of the GPGSL Boosts Tracking Application, covering all major features, technical implementation details, and usage workflows. The system successfully automates the boost submission and tracking process while providing administrators with powerful tools for managing the Grand Prix Games forum competition, including comprehensive activity requirement monitoring.
