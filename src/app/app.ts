import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Assignment {
  name: string;
  date: string;
  dueDate: Date;
  completed: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  // Game state
  protected readonly hp = signal(3);
  protected readonly maxHp = signal(3);
  protected readonly streak = signal(0);
  protected readonly playerX = signal(-70);
  protected readonly enemyX = signal(100);
  protected readonly displayMessage = signal('Welcome to the Student Productivity Game! Complete assignments before they reach you!');
  protected readonly enemyImage = signal<string>('/enemies/blue_slime.png');
  protected readonly showPanel = signal(false);
  protected readonly adminButtonSrc = signal<string>('/backgrounds/@admin_button.png');

  // Teacher UI state
  protected readonly students = signal<Array<{ username: string; assignments: { name: string; date: string; dueISO: string; completed: boolean; percentage: number }[] }>>([
    { username: 'Alex',  assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: false, percentage: 78 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: true, percentage: 92 } ] },
    { username: 'Blake', assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: true,  percentage: 85 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: false, percentage: 61 } ] },
    { username: 'Casey', assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: true,  percentage: 96 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: true,  percentage: 88 } ] },
    { username: 'Devon', assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: false, percentage: 55 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: false, percentage: 40 } ] },
    { username: 'Emery', assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: true,  percentage: 90 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: false, percentage: 70 } ] },
    { username: 'Finley',assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: true,  percentage: 82 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: true,  percentage: 79 } ] },
    { username: 'Gray',  assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: false, percentage: 47 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: true,  percentage: 68 } ] },
    { username: 'Harper',assignments: [ { name: 'Homework 1', date: 'Oct 8',  dueISO: new Date().toISOString(), completed: true,  percentage: 93 }, { name: 'Homework 2', date: 'Oct 12', dueISO: new Date().toISOString(), completed: false, percentage: 62 } ] },
  ]);
  protected newAssignmentName = '';
  protected newAssignmentDate = '';
  
  // Game data
  protected readonly currentAssignment = signal<Assignment>({
    name: 'Math Assignment',
    date: 'Oct 5th',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    completed: false
  });
  

  private gameInterval?: number;
  private cloudInterval?: number;

  ngOnInit() {
    this.enemyImage.set(this.pickRandomEnemy());
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
      const COLLISION_DISTANCE_PX = 80; // tweak to match sprite sizes
      const currentX = this.enemyX();
      const targetX = this.playerX() + COLLISION_DISTANCE_PX;
      const step = 2;
      const newX = currentX > targetX ? currentX - step : targetX;
      this.enemyX.set(newX);

      // Check if enemy hit player
      if (newX <= targetX && !this.currentAssignment().completed) {
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
    this.enemyImage.set(this.pickRandomEnemy());
    this.displayMessage.set(`New assignment: ${randomAssignment}. Complete it before the due date!`);
  }

  private resetGame() {
    this.hp.set(100);
    this.streak.set(0);
    this.enemyX.set(200);
    this.createNewAssignment();
  }

  // Event handlers referenced from the template
  protected onEnemyLoad(): void {
    // Intentionally empty; reserved for future logging/analytics
  }

  protected onEnemyError(): void {
    // Intentionally empty; could set a fallback image here if needed
  }

  // UI panel controls
  protected openPanel(): void { this.showPanel.set(true); }
  protected closePanel(): void { this.showPanel.set(false); }
  protected onAdminImgError(): void {
    // Fallback to non-@ filename if provided asset doesn't exist
    this.adminButtonSrc.set('/backgrounds/admin_button.png');
  }

  protected addAssignment(): void {
    const name = this.newAssignmentName?.trim();
    if (!name) { return; }
    const dateStr = this.newAssignmentDate || new Date().toISOString().slice(0,10);
    const date = new Date(dateStr);
    const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    this.students.update(list => list.map(s => ({
      ...s,
      assignments: [
        ...s.assignments,
        { name, date: dateLabel, dueISO: date.toISOString(), completed: false, percentage: 0 }
      ]
    })));
    this.newAssignmentName = '';
    this.newAssignmentDate = '';
  }

  protected deleteAssignmentForAll(nameToDelete: string): void {
    const key = (nameToDelete || '').trim().toLowerCase();
    if (!key) { return; }
    this.students.update(list => list.map(s => ({
      ...s,
      assignments: s.assignments.filter(a => a.name.toLowerCase() !== key)
    })));
  }

  // Helper used in template to avoid complex/new expressions there
  protected isOverdue(dueISO: string): boolean {
    try {
      return new Date(dueISO).getTime() < Date.now();
    } catch {
      return false;
    }
  }

  private pickRandomEnemy(): string {
    const enemyFiles = [
      '/enemies/blue_slime.png',
      '/enemies/fire_golem.png',
      '/enemies/green_slime.png',
      '/enemies/old_golem.png',
      '/enemies/red_slime.png',
      '/enemies/water_golem.png',
    ];
    const index = Math.floor(Math.random() * enemyFiles.length);
    return enemyFiles[index];
  }

}