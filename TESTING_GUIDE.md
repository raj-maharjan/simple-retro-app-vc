# Testing Guide for Retrospective Meeting App

This guide covers the comprehensive test suite for the retrospective meeting application, including unit tests for all major functionalities.

## 📚 **Test Framework & Setup**

### **Testing Stack**
- **Vitest**: Fast unit test runner built for Vite
- **React Testing Library**: Component testing utilities
- **JSDOM**: DOM environment for testing
- **User Event**: Realistic user interaction simulation

### **Configuration**
- Tests are configured in `vite.config.ts`
- Setup file: `src/test/setup.ts`
- Test environment: `jsdom`

## 🚀 **Running Tests**

### **Available Commands**
```bash
# Run tests in watch mode (development)
npm run test

# Run tests once (CI/production)
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## 🧪 **Test Coverage Overview**

### **1. Authentication System** (`src/contexts/__tests__/AuthContext.test.tsx`)

**Coverage:**
- ✅ Initial auth state management
- ✅ Sign up functionality (development vs production)
- ✅ Sign in with email/password
- ✅ Google OAuth integration
- ✅ Sign out functionality
- ✅ Domain restrictions (@grepsr.com)
- ✅ Environment-based behavior
- ✅ Error handling
- ✅ Context provider validation

**Key Test Scenarios:**
```typescript
// Tests environment-based restrictions
it('blocks sign up for non-grepsr.com emails in production')
it('allows any email in development environment')

// Tests OAuth functionality
it('handles Google sign in successfully')
it('restricts Google OAuth to grepsr.com in production')

// Tests error scenarios
it('handles auth errors properly')
it('throws error when used outside provider')
```

### **2. Authentication Form** (`src/components/__tests__/AuthForm.test.tsx`)

**Coverage:**
- ✅ Sign in form rendering and validation
- ✅ Sign up form rendering and validation
- ✅ Google OAuth button functionality
- ✅ Form validation (email format, password length)
- ✅ Password visibility toggle
- ✅ Environment-based UI changes
- ✅ Loading states and error handling
- ✅ Form submission prevention

**Key Test Scenarios:**
```typescript
// Tests form interactions
it('submits sign in form with valid data')
it('validates email format')
it('enforces minimum password length')

// Tests UI behavior
it('toggles password visibility')
it('shows restriction message in production')
it('displays authentication errors')
```

### **3. Note Management** (`src/components/__tests__/NoteColumn.test.tsx`)

**Coverage:**
- ✅ Note column rendering
- ✅ Adding new notes
- ✅ Editing existing notes
- ✅ Deleting notes (own notes only)
- ✅ Like/unlike functionality
- ✅ Typing indicators (real-time)
- ✅ User display names and avatars
- ✅ Drag and drop support
- ✅ Accessibility features
- ✅ Performance with large note counts

**Key Test Scenarios:**
```typescript
// Tests note operations
it('adds a new note successfully')
it('allows editing own notes')
it('shows delete button only for own notes')

// Tests real-time features
it('shows typing indicator when someone is typing')
it('calls typing start on input focus')

// Tests performance
it('renders large number of notes efficiently')
```

### **4. Dashboard Management** (`src/components/__tests__/Dashboard.test.tsx`)

**Coverage:**
- ✅ Dashboard layout and navigation
- ✅ Create meeting workflow
- ✅ Join meeting functionality
- ✅ Meeting list display
- ✅ User profile management
- ✅ Real-time meeting updates
- ✅ Loading and error states
- ✅ Accessibility compliance
- ✅ Form validation

**Key Test Scenarios:**
```typescript
// Tests meeting management
it('shows create meeting form when button is clicked')
it('transforms meeting code to uppercase')
it('submits join meeting form')

// Tests user interaction
it('allows user to sign out')
it('supports keyboard navigation')

// Tests edge cases
it('handles user without profile gracefully')
it('handles loading state gracefully')
```

### **5. Email Service** (`src/lib/__tests__/emailService.test.ts`)

**Coverage:**
- ✅ Email data preparation
- ✅ Meeting summary generation
- ✅ Participant extraction
- ✅ Duration calculation
- ✅ Note categorization
- ✅ Email sending functionality
- ✅ Edge function integration
- ✅ Error handling
- ✅ Edge cases (malformed data, long content)

**Key Test Scenarios:**
```typescript
// Tests data preparation
it('prepares email data correctly for ended meeting')
it('calculates meeting duration correctly')
it('groups notes by type correctly')

// Tests email sending
it('sends emails successfully to all participants')
it('handles edge function errors gracefully')
it('handles empty participants list')
```

## 🎯 **Test Categories**

### **Unit Tests**
- Component rendering
- Function behavior
- State management
- Props handling
- Event handling

### **Integration Tests**
- Component interactions
- Context provider integration
- API service calls
- Real-time functionality

### **Accessibility Tests**
- ARIA labels and roles
- Keyboard navigation
- Screen reader compatibility
- Focus management

### **Performance Tests**
- Large dataset rendering
- Memory usage
- Render optimization
- User interaction responsiveness

## 🔧 **Mocking Strategy**

### **Supabase Client**
```typescript
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { /* auth methods */ },
    from: vi.fn().mockReturnValue({ /* query builder */ }),
    channel: vi.fn().mockReturnValue({ /* real-time channel */ }),
  },
}));
```

### **React Beautiful DnD**
```typescript
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) => <div>{children(mockProvided)}</div>,
  Draggable: ({ children }) => <div>{children(mockProvided)}</div>,
}));
```

### **Browser APIs**
```typescript
// Clipboard API
Object.assign(navigator, {
  clipboard: { writeText: vi.fn(), readText: vi.fn() }
});

// Crypto API
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: vi.fn().mockReturnValue('mock-uuid') }
});
```

## 📊 **Coverage Goals**

### **Target Coverage**
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

### **Critical Path Coverage**
- ✅ Authentication flows
- ✅ Meeting creation/joining
- ✅ Note CRUD operations
- ✅ Real-time synchronization
- ✅ Email notifications
- ✅ Error handling

## 🛠️ **Writing New Tests**

### **Test File Structure**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('ComponentName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should test specific behavior', async () => {
      // Arrange
      const user = userEvent.setup();
      
      // Act
      render(<Component />);
      await user.click(screen.getByRole('button'));
      
      // Assert
      expect(screen.getByText('Expected')).toBeInTheDocument();
    });
  });
});
```

### **Best Practices**
- Use descriptive test names
- Group related tests with `describe`
- Mock external dependencies
- Test user interactions, not implementation details
- Include accessibility tests
- Test error scenarios
- Use `beforeEach` for setup

## 🔍 **Debugging Tests**

### **Common Issues**
- **Missing mocks**: Ensure all external dependencies are mocked
- **Async operations**: Use `waitFor` for async updates
- **User events**: Use `userEvent` instead of `fireEvent`
- **Accessibility**: Test with screen readers in mind

### **Debug Commands**
```bash
# Run specific test file
npm run test AuthContext.test.tsx

# Run tests in debug mode
npm run test --reporter=verbose

# Run tests with coverage
npm run test:coverage
```

## 🚀 **CI/CD Integration**

### **GitHub Actions Example**
```yaml
- name: Run Tests
  run: |
    npm ci
    npm run test:run
    npm run test:coverage
```

### **Pre-commit Hooks**
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:run && npm run lint"
    }
  }
}
```

## 📈 **Performance Monitoring**

### **Test Performance**
- Monitor test execution time
- Identify slow tests
- Optimize mocks and setup
- Use `--reporter=verbose` for insights

### **Application Performance**
- Test large dataset rendering
- Monitor memory usage patterns
- Test user interaction responsiveness
- Validate performance regressions

## 🎯 **Continuous Improvement**

### **Regular Tasks**
- Update test coverage reports
- Review and refactor slow tests
- Add tests for new features
- Update mocks for API changes
- Monitor test flakiness

### **Metrics to Track**
- Test coverage percentage
- Test execution time
- Number of flaky tests
- Test maintenance overhead

This comprehensive testing strategy ensures high code quality, prevents regressions, and provides confidence in deployments. 