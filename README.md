CARPOOLING SYSTEM

1. Problem Statement (PS)
The Carpooling System is a smart ride-sharing platform that connects drivers and riders traveling in the same direction. The system enables users to create, search, and join ride pools while ensuring safety, privacy, and efficiency.

 Objectives:
 
•	Reduce travel cost 
•	Minimize traffic congestion 
•	Optimize vehicle usage 
•	Ensure user safety & privacy 
________________________________________

2. Workflow

 Driver Workflow

1.	Register/Login 
2.	Create Ride 
3.	Enter details (pickup, drop, time, seats) 
4.	Publish ride 
5.	Receive join requests 
6.	Accept/Reject riders 
7.	Start ride 
8.	Complete ride 
________________________________________

 Rider Workflow

1.	Register/Login 
2.	Search rides 
3.	Apply filters (location, time, preferences) 
4.	View matching rides 
5.	Select ride 
6.	Send request 
7.	Wait for approval 
8.	Join ride 
9.	Complete ride 
________________________________________

Matching Workflow

1.	Fetch available rides 
2.	Compare routes 
3.	Calculate match percentage 
4.	Rank rides 
5.	Display best matches 
________________________________________

3. System Architecture

High-Level Architecture
Frontend (Web/App)
        ↓
Backend (API Server)
        ↓
Services Layer:
   - User Service
   - Ride Service
   - Matching Service
   - Notification Service
        ↓
Database (MongoDB/MySQL)
        ↓
External APIs:
   - Maps API
   - SMS/Notification API
________________________________________

Components

1. Frontend
•	UI for users 
•	Forms for ride creation/search 
2. Backend
•	Handles API requests 
•	Business logic 
3. Database
•	Stores users, rides, requests 
4. External Services
•	Maps for route calculation 
•	Notifications (SMS/Push) 
________________________________________

 4. Flowchart

START
   ↓
Login / Register
   ↓
Is User Driver?
   ↓
 ┌──────────────------┐
 │ YES           │ NO            │
 ↓               ↓
Create Ride      Search Ride
 ↓               ↓
Store in DB      Fetch Rides
 ↓               ↓
Wait Requests    Match Algorithm
 ↓               ↓
Accept/Reject    Show Results
 ↓               ↓
Ride Start ← Request Sent
   ↓
Ride Completed
   ↓
END
________________________________________

5. Class Diagram (OOP Design)

User
-----------------
userId
name
email
password
role
-----------------
login()
register()

Driver extends User
-----------------
vehicleDetails
-----------------
createRide()
approveRequest()

Rider extends User
-----------------
preferences
-----------------
searchRide()
requestRide()

Ride
-----------------
rideId
pickup
drop
time
seats
driverId
-----------------
addPassenger()
removePassenger()

RideRequest
-----------------
requestId
rideId
riderId
status
-----------------
approve()
reject()

MatchingService
-----------------
calculateMatch()
findBestRides()

NotificationService
-----------------
sendNotification()
________________________________________

6. Algorithms Used

 1. Ride Matching Algorithm
Input:
•	Rider location & destination 
•	Available rides 
Logic:
•	Calculate distance between routes 
•	Compare pickup & drop points 
•	Check time compatibility 
•	Assign match percentage 
Output:
•	Sorted list of best rides 
________________________________________

 2. Route Matching (Basic Approach)

match % = (common route distance / total route distance) * 100
________________________________________

 3. Filtering Algorithm

•	Filter rides based on: 
o	Time 
o	Location 
o	Preferences 
________________________________________

 4. Search Optimization

•	Use indexing in database 
•	Use caching (Redis) 
________________________________________

7. Important Concepts

 Authentication
•	JWT-based login system 
•	Role-based access (Driver/Rider) 
________________________________________

Caching

•	Store frequently searched rides 
•	Reduce database load 
________________________________________

Fault Tolerance

•	Retry failed requests 
•	Backup database 
•	Error recovery system 
________________________________________

Scalability

•	Microservices architecture 
•	Load balancing 
________________________________________

Privacy

•	Mask phone numbers 
•	Limited profile visibility 
•	SOS emergency feature 
________________________________________

8. Trade-offs

Aspect	    Option	  Trade-off
Database	SQL	      Strong consistency, less scalable
Database	NoSQL	  High scalability, less strict
Matching	Accurate  Slower
Matching	Fast	  Less precise
________________________________________

9. Testing Strategy

•	Unit Testing (functions) 
•	API Testing (Postman) 
•	Integration Testing 
•	Edge cases (no rides, full seats) 
________________________________________

10. Key Features Summary

•	Ride creation & joining 
•	Intelligent matching 
•	Route match percentage 
•	Privacy protection 
•	Request approval system 
________________________________________

11. Future Enhancements

•	Real-time tracking (WebSockets) 
•	Payment integration 
•	Chat system 
•	Rating & review system 
•	AI-based ride prediction 

12. Conclusion

•	The Carpooling System is a scalable and efficient ride-sharing solution that optimizes transportation by intelligently matching drivers and riders while ensuring safety, privacy, and convenience.


13. Pesudo codes

1. MAIN SYSTEM FLOW
START

INPUT userChoice (Login/Register)

IF Register:
    CALL registerUser()

ELSE IF Login:
    CALL loginUser()

IF user.role == DRIVER:
    CALL driverWorkflow()

ELSE IF user.role == RIDER:
    CALL riderWorkflow()

END
________________________________________

2. DRIVER WORKFLOW
FUNCTION driverWorkflow():

    DISPLAY "1. Create Ride"

    INPUT choice

    IF choice == 1:
        ride = createRide()
        saveRideToDB(ride)

        WHILE ride not started:
            requests = fetchRideRequests(ride.id)

            FOR each request IN requests:
                DISPLAY request details

                INPUT decision (ACCEPT / REJECT)

                IF ACCEPT:
                    approveRequest(request)
                    addPassenger(ride, request.riderId)

                ELSE:
                    rejectRequest(request)

        START ride

        COMPLETE ride

END FUNCTION
________________________________________

3. RIDER WORKFLOW
FUNCTION riderWorkflow():

    DISPLAY "Search Rides"

    INPUT source, destination, time, preferences

    rides = searchRides(source, destination, time)

    filteredRides = applyFilters(rides, preferences)

    matchedRides = matchRides(filteredRides, source, destination)

    DISPLAY matchedRides

    INPUT selectedRide

    request = createRideRequest(selectedRide, riderId)

    sendRequestToDriver(request)

    WAIT for approval

    IF approved:
        JOIN ride
        COMPLETE ride

    ELSE:
        DISPLAY "Request Rejected"

END FUNCTION
________________________________________

4. MATCHING ALGORITHM
FUNCTION matchRides(rides, source, destination):

    resultList = EMPTY LIST

    FOR each ride IN rides:

        routeMatch = calculateRouteMatch(ride, source, destination)
        timeMatch = checkTimeCompatibility(ride.time, requestedTime)

        matchPercentage = (routeMatch * 0.7) + (timeMatch * 0.3)

        ADD (ride, matchPercentage) TO resultList

    SORT resultList BY matchPercentage DESC

    RETURN resultList

END FUNCTION
________________________________________

5. ROUTE MATCH CALCULATION
FUNCTION calculateRouteMatch(ride, source, destination):

    commonDistance = getCommonRouteDistance(ride.route, source, destination)

    totalDistance = getTotalRouteDistance(ride.route)

    matchPercentage = (commonDistance / totalDistance) * 100

    RETURN matchPercentage

END FUNCTION
________________________________________

6. FILTERING ALGORITHM
FUNCTION applyFilters(rides, preferences):

    filtered = EMPTY LIST

    FOR each ride IN rides:

        IF ride.time matches preferences.time AND
           ride.location matches preferences.location AND
           ride.seatsAvailable > 0:

            ADD ride TO filtered

    RETURN filtered

END FUNCTION
________________________________________

7. RIDE REQUEST HANDLING
FUNCTION createRideRequest(rideId, riderId):

    request.id = generateId()
    request.rideId = rideId
    request.riderId = riderId
    request.status = "PENDING"

    saveRequestToDB(request)

    RETURN request
FUNCTION approveRequest(request):

    request.status = "APPROVED"
    updateDB(request)

END FUNCTION
FUNCTION rejectRequest(request):

    request.status = "REJECTED"
    updateDB(request)

END FUNCTION
________________________________________

 8. AUTHENTICATION (JWT BASIC FLOW)
FUNCTION loginUser():

    INPUT email, password

    user = findUser(email)

    IF user.password == hash(password):
        token = generateJWT(user)
        RETURN token
    ELSE:
        DISPLAY "Invalid Credentials"

END FUNCTION
________________________________________

9. SEARCH OPTIMIZATION (CACHING)
FUNCTION searchRides(source, destination, time):

    cacheKey = source + destination + time

    IF cache exists(cacheKey):
        RETURN cacheData

    rides = queryDatabase(source, destination, time)

    storeInCache(cacheKey, rides)

    RETURN rides

END FUNCTION
________________________________________

10. NOTIFICATION SERVICE
FUNCTION sendNotification(userId, message):

    user = getUser(userId)

    SEND SMS or PUSH notification

END FUNCTION
________________________________________

11. EDGE CASE HANDLING
IF no rides found:
    DISPLAY "No rides available"

IF ride seats full:
    BLOCK further requests

IF driver cancels ride:
    notify all riders



TEAM NAME : ACTIVE LEARNERS
1.SNEHA MAURYA (LEADER)
2.SHIVANSH GUPTA
3.YASH RAJ SRIVASTAVA

