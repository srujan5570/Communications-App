# Sample Output images
![WhatsApp Image 2025-04-28 at 16 41 00_7af69582](https://github.com/user-attachments/assets/c47e4f7a-11c2-4d08-b070-49bef58bac7d)
![WhatsApp Image 2025-04-28 at 16 41 01_c89ca178](https://github.com/user-attachments/assets/7bf9e417-874f-4577-93b1-e22f71ba467c)
![WhatsApp Image 2025-04-28 at 16 41 01_2214497a](https://github.com/user-attachments/assets/530d6f1f-3792-43e9-805a-9db10e10bdbc)
![WhatsApp Image 2025-04-28 at 16 41 00_761a06de](https://github.com/user-attachments/assets/d100ffc6-4369-48d2-b304-c4ace7896c5f)
![WhatsApp Image 2025-04-28 at 16 40 59_8f0e049f](https://github.com/user-attachments/assets/d5a22796-3c37-4ef8-942e-704f13e5331f)

# Real-Time Chat Application

A modern real-time chat application built with React Native and Expo, featuring a clean UI and seamless messaging experience.

## Features

- **Real-time Messaging**: Instant message delivery using Socket.IO
- **User Authentication**: Secure login and registration system
- **Online/Offline Status**: Real-time user status indicators
- **Message History**: Persistent chat history with timestamp display
- **Modern UI**: Clean and responsive interface with smooth animations
- **Message Status**: Delivery status indicators for messages (sent, delivered)

## Technologies Used

- **Frontend**:
  - React Native
  - Expo
  - React Navigation
  - Socket.IO Client
  - AsyncStorage for local data persistence

- **Backend**:
  - Node.js
  - Express.js
  - MongoDB
  - Socket.IO
  - JWT Authentication

## Prerequisites

Before running the application, make sure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- Expo CLI
- MongoDB (if running backend locally)
- Expo Go app on your mobile device (for testing)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your configuration:
```env
API_URL=your_api_url
SOCKET_URL=your_socket_url
```

4. Start the development server:
```bash
npm start
```

5. Scan the QR code with Expo Go app (Android) or Camera app (iOS)

## Project Structure

```
src/
├── screens/          # Screen components
│   ├── LoginScreen.tsx
│   ├── ChatListScreen.tsx
│   └── ChatScreen.tsx
├── components/       # Reusable components
├── navigation/       # Navigation configuration
├── services/        # API and socket services
└── utils/           # Utility functions
```

## Features in Detail

### Authentication
- User registration with email and username
- Secure login with JWT token
- Token persistence using AsyncStorage

### Chat Features
- Real-time message delivery
- Message status indicators (sent, delivered)
- Timestamp display for messages
- User online/offline status
- Chat history persistence
- Auto-scroll to latest messages

### UI/UX Features
- Clean and modern interface
- Responsive design
- Loading indicators
- Error handling with user feedback
- Pull-to-refresh functionality
- Keyboard-aware layouts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special thanks to the React Native and Expo communities for their excellent documentation and support 
