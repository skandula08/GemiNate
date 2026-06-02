1. ## Feature Overview and User Manual

1. ### Build process

Firstly in order to build our project, GemiNate, locally, we need the source code downloaded onto our machine. After unzipping or cloning the project, open it in visual studio code, or locate the folder in your terminal and cd into it.

To build the project, first make sure npm is installed, then run npm install at the project root. The project also needs environment variables, namely for the google SSO and the soundcloud API. These environment variables should be received from those sources.

After building and filling out the .env files, one can run npm run dev to run both the server and the client in development mode. When deploying to an environment, one must also fill out the .env files there.

The deployed application can be found here: [https://gamenite-gs0z.onrender.com/](https://gamenite-gs0z.onrender.com/)

2. ### User Interactions

In order to interact with GemiNate’s new features, the ones that were added and updated by us, users can follow the following steps for each user story:

1. #### Blackjack

   Blackjack is a game, similar to Nim and Number Guesser, so it can be accessed through the games subtab on the sidebar, or the site root/games. Then, one can either select “Create New Game” or on one of the existing Blackjack games. Blackjack requires at least two users to play, so you need at least two separate users to join the game to start.![][image1]  
   The player who created the game can then choose the number of rounds and decks, and players can take turns making moves in Blackjack. The moves that a player can make are shown to them on the screen.  
   ![][image2]  
   After all players have made moves on every round, the game will end. This is all you need to play Blackjack. The rules are fairly simple, your goal is to try to get as close to 21 points as possible without going over, so you beat the computer, who will draw cards until they reach 17 or more points.

2. #### Communities

   #### Communities, too, are found on the sidebar. Click on the tab labeled communities. Users can make only one community per day.

![][image3]  
To create a community, click the button labeled as such, and enter a name. If you would like it to be private, click the “private” checkbox before making your community. You can also enter a description.  
Upon making your community, it will appear in your “My Communities” list. You can click on it to enter, and others can see it if it is public, and join by pressing “join.” Note that for them it will appear in the “joinable communities” list.  
As the owner of the community, you can make edits to its information.  
![][image4]  
	You can upload a banner from your device, set a new name, and enter a new description in the labeled text fields. Once you’ve finished making your changes to the community’s details you can hit the button “Save Changes” which will take you back to the main community page and let you see the updates you’ve made.  	![][image5]  
You can invite new members to your private communities as well. This is done in the main community page. Enter their username (not their display name) to invite them.![][image6]  
This community is not in either list as it is private, but the user who has been invited sees a message to join here.  
![][image7]  
As the owner, you can then modify the user. You can make them a DJ, kick, ban, or transfer ownership.  
![][image8]  
Beyond the Jukebox, which will be discussed in section D, users’ primary motivation to make communities is to use the exclusive community chats. Any member of a community can send chat messages to be read by other members of the community.  
![][image9]  
Users can see chat messages update in real time, as long as they are currently on that community’s page.

3. #### Profile Enhancements

   Profile enhancements can be done through your profile menu.![][image10]  
   These are the new fields that were added in GemiNate.  
     
   Users can select a profile picture from their local files and it will be cropped to a square. They can also choose pronouns from a drop-down of common English pronouns and pronoun sets. Note that “it/its” is rarely but genuinely used by some individuals, and is not meant to be derogatory. If users want to use multiple sets, or a neopronoun, they can also specify “Other” and write their pronouns in a field.![][image11]  
   

4. #### Jukebox

   Jukeboxes are primarily accessed through communities and are directly tied to a community. If you are the community’s owner or a DJ (see above), you can interact with a community’s jukebox \- regular users are still able to interact with a Jukebox’s volume, so that they can turn it down or off, and they can request to be a DJ.![][image12]  
   Here, a user is searching for “music.” ![][image13]  
   This will come up with a list of tracks users can add. These are taken directly from Soundcloud’s API.  
     
   A DJ or an owner can then add these tracks to the community’s queue. The tracks can be moved in the queue or removed, and then paused or played, set to loop, skipped, or shuffled.  
   ![][image14]  
     
   	 Note that the tracks that can be played are the ones that are available through Soundcloud, which makes this functionality visible and public to the uploader.

2. ## Technical Overview

In addition to rebranding the product to GemiNate and redesigning the site’s UI, our team implemented three major user stories on top of the existing code: a brand-new live blackjack game, profile improvements and social communities, and finally live music streaming through our jukebox feature. In this report, we will discuss each user story separately, discussing profile improvements and communities separately, for simplicity.

Over the course of this project, we have completed all of the essential and desirable conditions of satisfaction we laid out for ourselves. Thankfully, we didn’t have to update our scope\!

| USER STORIES | CONDITIONS OF SATISFACTION | PRIORITY | Complete? |
| ----- | ----- | ----- | ----- |
| 1\. As a player on GameNite, I want to be able to play blackjack live with several other players so that I can learn from others’ strategies within a social experience. | 1.1. Players can start a blackjack game with between 2 and 6 players | Essential | Fully |
|  | 1.2. Blackjack game will implement a representation of a deck of cards that can be shuffled and dealt to players | Essential | Fully |
|  | 1.3. Players are dealt cards from the deck at the beginning of the game, and the dealer (the server) draws one card | Essential | Fully |
|  | 1.4. Players are able to see the cards that are on the table graphically. | Essential | Fully |
|  | 1.5. Players are able to hit or stand on their turn, and the game will properly let them continue or bust. | Essential | Fully |
|  | 1.6. The dealer will draw a new card at the end of the round, unless their cards total to 17 or higher. If the dealer busts, all players who have not already busted win. | Essential | Fully |
|  | 1.7. At the end of each round, all players who do not bust and have cards closer in value to 21 than the dealer are granted a win, and other players are granted a loss. | Essential | Fully |
|  | 1.8. Room creator sets  number of blackjack games, and players can bet chips. Whoever has the most chips at the end of the games wins. | Desirable | Fully |
|  | 1.9. Players should be warned when placing large bets. | Desirable | Fully |
|  | 1.10. Graphics resemble playing cards and the table resembles casino tables. | Desirable | Fully |
|  | 1.11. Multi-deck options to prevent card-counting | Desirable | Fully |
|  | 1.12. Animated cards, betting, and dealing | Extension | Partially – there are some animations but the cards are not drawn out in an animation |
|  | 1.13 The number of chips earned by each player is persisted across games, allowing for players to enter new games with the number of chips they had when they left their last game. | Extension | No |
| 2\.  As a user of GameNite, I want to customize my profile and create communities so I can express myself and interact with other users. | 2.1. Users can set a profile picture to any .jpg or .png they upload, or to a default option | Essential | Fully |
|  | 2.2. A user’s profile picture will be displayed next to their name on their profile page, in activity logs (e.g. “Alice started the game”), and in chat messages | Essential | Fully |
|  | 2.3. Users can write their own bios that will be displayed publicly on their profile. | Desirable | Fully |
|  | 2.4. Users can sign in using external applications (SSO), such as a Google account. | Essential | Fully |
|  | 2.5. Users can add personal pronouns to a dedicated field on their profile to display on their profile | Desirable | Fully |
|  | 2.6. Can create a community and send invite messages | Essential | Fully |
|  | 2.7. The user who created the community is the owner of the community \- community owners can kick or ban users from the community. | Essential | Fully |
|  | 2.8. Private communities should only be accessible by members | Essential | Fully |
|  | 2.9. Community owners cannot leave without passing the community owner role to someone else. | Essential | Fully |
|  | 2.10. Users can only create up to one community every day. | Desirable | Fully |
|  | 2.11. The owner(s) should be able to customize the name and picture of a community. | Essential | Fully |
|  | 2.12. Communities can be set to public, and anyone can join from a public communities page | Extension | Fully |
| 3\. As a member of the gaming community here on GameNite, I want to collaborate with other players to create a fun lively environment by sharing music that we can play during games. | 3.1. Users in a community can listen to music together simultaneously. | Essential | Fully |
|  | 3.2. Owner can grant community members a “DJ” role which will give members the ability to update the music playlist | Essential | Fully |
|  | 3.3. Owners and DJ members can add tracks to their community’s jukebox. (Music can be added through an API call to the Soundcloud API *OR* with an MP3 upload.) | Essential | Fully |
|  | 3.4. Users can select a community, which will play that community’s jukebox for them. | Essential | Fully |
|  | 3.5. All members can control their own volume (including muting) of the music playback without impacting the volume for other members | Essential | Fully |
|  | 3.6. Owners and DJ members can add and remove tracks to and from specific jukebox queue positions, and shuffle the jukebox queue | Essential | Fully |
|  | 3.7. Members can request access to the “DJ” role | Desirable | Fully |
|  | 3.8. Music will play site-wide, not just in the community chat | Desirable | Fully |
|  | 3.9. Owners and DJ members can choose to loop the entire jukebox queue, or individual tracks | Desirable | Fully |
|  | 3.10. Jukebox control bar appears site-wide, and can be moved around on the window | Extension | Partially \- the jukebox (music bar) can appear sitewide but it can’t be moved |

# 

### Blackjack

The game of Blackjack was added as a game alongside the existing Nim and Number Guesser games. The game relies on the players to make moves in a sequence. The implementation of Blackjack includes a betting stage, a stage where players can make moves (namely hitting, or drawing a card, and standing) and a dealer phase, which mostly serves to show the results of the individual round. The implementation of games within the original application relies on a move payload being made in order to make updates to the visuals, so every change to the board had to come from a user input; namely, the dealer phase instantly shows the dealer’s draws, and the player who started the game has to end it manually, to ensure every player is able to see what the dealer drew and if they won their bet or not.

### Profile Improvements

Profile improvements were added as extensions onto the existing profile structure. The main additions were pronouns, profile pictures, and bios, all optional additions to a user’s profile. The fact that they’re optional meant the addition was easy. Attributes were simply added to the existing UserRecord, and no migration was required since the attributes weren’t required.   
	To support updating these attributes, the existing UPDATE endpoint was simply extended, with the maximum request size increased to 5 MB in order to accommodate for base-64 encoded profile pictures.  
	Instead of using cloud storage, we chose to store all uploaded images directly in our Mongo documents as base-64 encoded URLs. These images are encoded and decoded in both the frontend and backend, such that they can be sent in a typical “application/json” request, without having to worry about multi-part form requests. While we admit that there is a trade-off in request and response size, we’ve determined that for the scope and scale of this project, that hindrance is acceptable and made up for by the reduction in complexity that comes from avoiding multi-part form requests and persistent cloud storage.  
	On the frontend, existing patterns were followed to display new profile information to other users and to present the edit form to the current user. Following existing patterns, a single hook was used to encapsulate the state of the Profile form.

### Communities

Users can create private and public communities, and other users can join them, either through invites or from the open communities list on the communities tab, a new tab on the sidebar that’s made specifically for communities. The user who created the community is designated as the owner (this role can be transferred later) and has the power to kick, ban, and invite other users. Each user can only create one community on a given calendar day.  
	Communities store a list of users, which includes all users who have joined a community, including kicked or banned users. It uses that list, which includes a users’ roles, to verify whether or not a user is allowed as part of a community, and to verify whether or not a user can make a request from the community’s controller. Kicked users can rejoin public communities and get invites back to private ones, but being banned is permanent.  
	Communities also have banners, names, and descriptions, and they can be changed similarly to the profile, but only by the owner. The banner, or background image, works similarly to the profile pictures, where they are stored as base-64 encoded URLs. See the above section on Profile Improvements to understand how they are stored \- they must be requested separately from the rest of a community in order to facilitate community load times.

### Jukebox

This feature is built around the SoundCloud API, with the intention to live broadcast music to multiple user sessions at once. Of course, webhooks stood out as a way to have bidirectional communication and manage the state of multiple sessions centrally.   
	At the data level, the entity we focused on was *Playlists*. These would be the shared entities responsible for the listening session produced for an arbitrary number of users. The idea is that each community has an associated playlist, and based on the community visited, any user can tune in to the associated playlist.   
	Finding these playlists by community, something that needs to happen fairly often, proved to be a more expensive and slower task than anticipated. To remedy this, we added the index PlaylistByCommunityIndex to allow for O(1) lookup, a big improvement\!  
	In connecting to SoundCloud, we chose to use their client authentication flow, which was a great idea because it avoids requiring users to have SoundCloud accounts. Storing the playlist persistently while playback is stateful also has its benefits. This way, the track queue survives restarts, but playback naturally resets, which matches user expectations.  
	The persistent music bar was chosen due to its similarity to existing music players. We found our initial design a bit confusing, but aligning with similar products not only provides us a jumping off point, but it means that our users will be primed to use our product correctly.

### Testing

The backend, server-side code has about 98.49% test coverage.  
The frontend was manually tested and shown to the TA during weekly meetings, and there are component tests for certain critical aspects of the implementation, such as for community features and the jukebox music bar.

3. ## Process Overview

1. ### Sprints

   During our 3 sprint process, with sprint 1 being significantly shorter, we mostly focused on one user story at a time, using sprint 1 to do most of blackjack, sprint 2 to do most of user communities and profiles, and sprint 3 was where we finished everything, including the music player, and implemented testing and polish. This was not what was planned in our original project plan \- this new user-story focused plan was suggested to us by our Mentor TA at the beginning of sprint 1\.

2. ### Sprint Reviews

   At the end of each sprint, we marked which tasks were complete, which were incomplete, and which were partially complete, and placed them as such in our task board. Near the end of each sprint, we would fill out the team sprint review sheets, aggregating related tasks together. We would then mark which tasks needed to be carried over to the next sprint, and which tasks were new that we would be taking on.

3. ### Sprint Retrospectives

   We mostly used retrospectives to gauge how much work we were able to accomplish versus what was expected, and to distribute work among the 3 group members at the beginning of each sprint. During the sprint, we would also often redistribute work, and during the retrospective, we would measure whose skills are where in regards to certain kinds of tasks.

4. ### Blameless Postmortems

   We did not have major issues during the project development, so any issues could be blamelessly placed rather easily. We were able to discuss what went wrong and what issues we were having during each sprint by the end. It helped that our TA mentor was so willing to help us with issues we were having during the sprint.

5. ### Summary

   Sprint 0 was for setup; we spent it doing research and writing pseudocode that could be fit into the actual implementation. We completed every task we could during that time, using it mostly to conduct all of our research, as we did not have many research tasks for sprint 1+.  
   For sprint 1, we pivoted to what the TA asked of us; to focus on one user story, and try to implement it fully. We focused on Blackjack and got most of its implementation done during that shorter sprint, finishing it up during sprint 2 and polishing it along with the rest of the project during sprint 3\.  
   For sprint 2, we then moved onto communities, then jukeboxes near the end, with communities taking most of the sprint. We finished up communities and got work done on jukeboxes, with communities being partially pushed into sprint 3\.  
   For sprint 3, we used the first week to finish both communities and jukeboxes, with the latter half of the sprint being used for polishing and testing, as well as completing the rest of the final project requirements.
