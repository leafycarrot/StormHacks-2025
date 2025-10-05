import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Assignment {
  name: string;
  date: string;
  dueDate: Date;
  completed: boolean;
  percentage?: number;
  incomplete?: boolean;
}

interface Student {
  username: string;
  assignments: Assignment[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  // Game state
  protected readonly hp = signal(100);
  protected readonly maxHp = signal(100);
  protected readonly streak = signal(0);
  protected readonly playerX = signal(50);
  protected readonly enemyX = signal(200);
  protected readonly cloud1Y = signal(50);
  protected readonly cloud2Y = signal(80);
  protected readonly displayMessage = signal('Welcome to the Student Productivity Game! Complete assignments before they reach you!');
  
  // Admin state
  protected readonly showAdmin = signal(false);
  protected readonly adminAuthenticated = signal(false);
  protected adminPassword = '';
  
  // Game data
  protected readonly currentAssignment = signal<Assignment>({
    name: 'Math Assignment',
    date: 'Oct 5th',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    completed: false
  });
  
  protected readonly students = signal<Student[]>([
    {
      username: 'Student 1',
      assignments: [
        { name: 'A 1', date: 'Oct 3rd', dueDate: new Date(), completed: false, percentage: 0, incomplete: true },
        { name: 'Math Test 3', date: 'Oct 5th', dueDate: new Date(), completed: true, percentage: 97, incomplete: false }
      ]
    },
    {
      username: 'Student 2',
      assignments: [
        { name: 'A 1', date: 'Oct 3rd', dueDate: new Date(), completed: true, percentage: 90, incomplete: false },
        { name: 'Math Test 3', date: 'Oct 5th', dueDate: new Date(), completed: false, percentage: 0, incomplete: true }
      ]
    }
  ]);

  private gameInterval?: number;
  private cloudInterval?: number;

  ngOnInit() {
    this.startGame();
  }

  ngOnDestroy() {
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
    }
    if (this.cloudInterval) {
      clearInterval(this.cloudInterval);
    }
  }

  private startGame() {
    // Move enemy closer to player over time
    this.gameInterval = setInterval(() => {
      const currentX = this.enemyX();
      const newX = Math.max(currentX - 2, this.playerX() + 30); // Stop when close to player
      this.enemyX.set(newX);
      
      // Check if enemy hit player
      if (newX <= this.playerX() + 30 && !this.currentAssignment().completed) {
        this.takeDamage(1);
        this.displayMessage.set('Assignment hit! You lost 1 HP. Complete assignments to avoid damage!');
      }
      
      // Check if assignment is overdue
      const now = new Date();
      if (now > this.currentAssignment().dueDate && !this.currentAssignment().completed) {
        this.takeDamage(10);
        this.displayMessage.set('Assignment overdue! You lost 10 HP!');
        this.completeAssignment();
      }
    }, 1000);

    // Animate clouds
    this.cloudInterval = setInterval(() => {
      this.cloud1Y.set(50 + Math.sin(Date.now() / 2000) * 20);
      this.cloud2Y.set(80 + Math.sin(Date.now() / 2500) * 15);
    }, 100);
  }

  private takeDamage(amount: number) {
    const newHp = Math.max(0, this.hp() - amount);
    this.hp.set(newHp);
    
    if (newHp <= 0) {
      this.displayMessage.set('Game Over! Your character has died. What happens next is to be decided...');
      this.resetGame();
    }
  }

  private completeAssignment() {
    this.currentAssignment.update(assignment => ({
      ...assignment,
      completed: true
    }));
    
    this.streak.update(s => s + 1);
    this.displayMessage.set('Assignment completed! Great job! Your streak increased.');
    
    // Move enemy back
    this.enemyX.set(200);
    
    // Create new assignment
    setTimeout(() => {
      this.createNewAssignment();
    }, 2000);
  }

  private createNewAssignment() {
    const assignments = ['Math Homework', 'Science Project', 'English Essay', 'History Report', 'Coding Challenge'];
    const randomAssignment = assignments[Math.floor(Math.random() * assignments.length)];
    const dueDate = new Date(Date.now() + (Math.random() * 3 + 1) * 24 * 60 * 60 * 1000); // 1-4 days
    
    this.currentAssignment.set({
      name: randomAssignment,
      date: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dueDate: dueDate,
      completed: false
    });
    
    this.enemyX.set(200);
    this.displayMessage.set(`New assignment: ${randomAssignment}. Complete it before the due date!`);
  }

  private resetGame() {
    this.hp.set(100);
    this.streak.set(0);
    this.enemyX.set(200);
    this.createNewAssignment();
  }

  protected toggleAdmin() {
    this.showAdmin.update(show => !show);
    if (!this.showAdmin()) {
      this.adminAuthenticated.set(false);
      this.adminPassword = '';
    }
  }

  protected authenticateAdmin() {
    if (this.adminPassword === 'admin123') {
      this.adminAuthenticated.set(true);
      this.displayMessage.set('Admin access granted! You can now manage student progress.');
    } else {
      this.displayMessage.set('Invalid password. Try again.');
      this.adminPassword = '';
    }
  }
}