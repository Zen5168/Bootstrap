# Pokémon FireRed Java Remake

An authentic recreation of the Pokémon FireRed experience built using Java. This project utilizes a local SQLite database for move-sets and stats, allowing for a completely offline gameplay experience.

## 🚀 Features
- **Offline Support**: Migrated from MySQL to SQLite for zero-configuration setup.
- **Core Mechanics**: Includes movement, wild encounters, and database-driven move logic.
- **Classic Feel**: Sprite-based rendering and audio integration.

---

## 🛠 Prerequisites

*   **Java Development Kit (JDK) 21** or higher.
*   **SQLite JDBC Driver**: `sqlite-jdbc-3.53.0.0.jar` (Must be included in your classpath).

---

## 🏃 How to Run

Modern Java (JDK 21+) requires explicit permission for libraries that call native code (like SQLite). Use the following methods to run the game correctly:

### Method 1: Using the Terminal
Navigate to your project root folder and execute the command below. 
> *Note: Ensure your `-cp` paths correctly point to your compiled classes and your SQLite JAR file.*
```bash
java --enable-native-access=ALL-UNNAMED -cp "build/classes;sqlite-jdbc-3.53.0.0.jar" com.game.main.FireRed
