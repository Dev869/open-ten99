import SwiftUI

struct CalendarView: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var theme
    @State private var displayDate = Date()
    @State private var selectedDate: Date? = nil
    @State private var viewMode = "Month"
    @State private var showSidePanel = false

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)
    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private let viewModes = ["Month", "Week", "List"]

    private var calendar: Calendar { Calendar.current }

    private var scheduledItems: [WorkItem] {
        firestoreService.workItems.filter { $0.scheduledDate != nil }
    }

    private var currentMonthLabel: String {
        displayDate.formatted(.dateTime.month(.wide).year())
    }

    private var itemCountLabel: String {
        let count = itemsForCurrentMonth.count
        return "\(count) item\(count == 1 ? "" : "s")"
    }

    private var itemsForCurrentMonth: [WorkItem] {
        scheduledItems.filter { item in
            guard let date = item.scheduledDate else { return false }
            return calendar.isDate(date, equalTo: displayDate, toGranularity: .month)
        }
    }

    private var thisWeekItems: [WorkItem] {
        let now = Date()
        let startOfWeek = calendar.dateInterval(of: .weekOfYear, for: now)?.start ?? now
        let endOfWeek = calendar.date(byAdding: .day, value: 7, to: startOfWeek) ?? now
        return scheduledItems.filter { item in
            guard let date = item.scheduledDate else { return false }
            return date >= startOfWeek && date < endOfWeek
        }
        .sorted { ($0.scheduledDate ?? .distantFuture) < ($1.scheduledDate ?? .distantFuture) }
    }

    private var itemsForSelectedDate: [WorkItem] {
        guard let selectedDate else { return [] }
        return scheduledItems.filter { item in
            guard let date = item.scheduledDate else { return false }
            return calendar.isDate(date, inSameDayAs: selectedDate)
        }
    }

    private func clientName(for item: WorkItem) -> String {
        firestoreService.clients.first { $0.id == item.clientId }?.name ?? "Unknown"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    calendarHeader
                    calendarContent
                }
            }
            #if os(iOS)
            .sheet(isPresented: $showSidePanel) {
                thisWeekPanel
                    .presentationDetents([.medium, .large])
            }
            #endif
        }
    }

    // MARK: - Header

    private var calendarHeader: some View {
        VStack(spacing: 12) {
            // Title row
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Calendar")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text(itemCountLabel)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                #if os(iOS)
                Button {
                    showSidePanel = true
                } label: {
                    Image(systemName: "sidebar.right")
                        .font(.title3)
                        .foregroundStyle(theme.accentColor)
                }
                #endif
            }
            .padding(.horizontal)

            // View mode toggle
            HStack(spacing: 0) {
                ForEach(viewModes, id: \.self) { mode in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewMode = mode
                        }
                    } label: {
                        Text(mode)
                            .font(.subheadline)
                            .fontWeight(viewMode == mode ? .semibold : .regular)
                            .foregroundStyle(viewMode == mode ? .white : .secondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                            .background(
                                viewMode == mode
                                    ? AnyShapeStyle(
                                        LinearGradient(
                                            colors: [gradientStart, gradientEnd],
                                            startPoint: .leading,
                                            endPoint: .trailing
                                        )
                                    )
                                    : AnyShapeStyle(Color.clear)
                            )
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(
                Capsule()
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.05), radius: 4, y: 1)
            )
            .padding(.horizontal)
        }
        .padding(.top, 8)
        .padding(.bottom, 12)
    }

    // MARK: - Content

    @ViewBuilder
    private var calendarContent: some View {
        switch viewMode {
        case "Month":
            monthView
        case "Week":
            weekView
        case "List":
            listView
        default:
            monthView
        }
    }

    // MARK: - Month View

    private var monthView: some View {
        HStack(spacing: 0) {
            VStack(spacing: 12) {
                // Month navigation
                HStack {
                    Button {
                        withAnimation {
                            displayDate = calendar.date(byAdding: .month, value: -1, to: displayDate) ?? displayDate
                        }
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.title3)
                            .fontWeight(.medium)
                            .foregroundStyle(theme.accentColor)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Text(currentMonthLabel)
                        .font(.title3)
                        .fontWeight(.semibold)

                    Spacer()

                    Button {
                        withAnimation {
                            displayDate = calendar.date(byAdding: .month, value: 1, to: displayDate) ?? displayDate
                        }
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.title3)
                            .fontWeight(.medium)
                            .foregroundStyle(theme.accentColor)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)

                // Weekday headers
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 8) {
                    ForEach(weekdays, id: \.self) { day in
                        Text(day)
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)

                // Day grid
                let days = daysInMonth()
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 6) {
                    ForEach(days, id: \.self) { date in
                        if let date {
                            dayCell(date: date)
                        } else {
                            Color.clear
                                .frame(height: 48)
                        }
                    }
                }
                .padding(.horizontal)

                // Selected day items
                if let selectedDate {
                    selectedDayList(date: selectedDate)
                }

                Spacer()
            }
            .padding(.top, 4)

            #if os(macOS)
            thisWeekPanel
                .frame(width: 300)
            #endif
        }
    }

    private func dayCell(date: Date) -> some View {
        let isToday = calendar.isDateInToday(date)
        let isSelected = selectedDate.map { calendar.isDate($0, inSameDayAs: date) } ?? false
        let dayItems = scheduledItems.filter { item in
            guard let d = item.scheduledDate else { return false }
            return calendar.isDate(d, inSameDayAs: date)
        }

        return Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                selectedDate = date
            }
        } label: {
            VStack(spacing: 2) {
                Text("\(calendar.component(.day, from: date))")
                    .font(.subheadline)
                    .fontWeight(isToday ? .bold : .regular)
                    .foregroundStyle(
                        isSelected ? .white : (isToday ? theme.accentColor : .primary)
                    )

                HStack(spacing: 2) {
                    ForEach(Array(dayItems.prefix(3).enumerated()), id: \.offset) { _, item in
                        Circle()
                            .fill(colorForType(item.type))
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        isSelected
                            ? AnyShapeStyle(
                                LinearGradient(
                                    colors: [gradientStart, gradientEnd],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            : isToday
                                ? AnyShapeStyle(theme.accentColor.opacity(0.1))
                                : AnyShapeStyle(Color.clear)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private func selectedDayList(date: Date) -> some View {
        let items = itemsForSelectedDate
        return VStack(alignment: .leading, spacing: 8) {
            Text(date.formatted(date: .long, time: .omitted))
                .font(.subheadline)
                .fontWeight(.semibold)
                .padding(.horizontal)

            if items.isEmpty {
                Text("No items scheduled")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            } else {
                ForEach(items) { item in
                    calendarItemRow(item)
                        .padding(.horizontal)
                }
            }
        }
        .padding(.top, 8)
    }

    // MARK: - Week View

    private var weekView: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(thisWeekItems) { item in
                    calendarItemRow(item)
                }

                if thisWeekItems.isEmpty {
                    VStack(spacing: 12) {
                        Spacer(minLength: 40)
                        Image(systemName: "calendar")
                            .font(.system(size: 40))
                            .foregroundStyle(.quaternary)
                        Text("No items this week")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
    }

    // MARK: - List View

    private var listView: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(scheduledItems.sorted(by: {
                    ($0.scheduledDate ?? .distantFuture) < ($1.scheduledDate ?? .distantFuture)
                })) { item in
                    calendarItemRow(item)
                }

                if scheduledItems.isEmpty {
                    VStack(spacing: 12) {
                        Spacer(minLength: 40)
                        Image(systemName: "calendar")
                            .font(.system(size: 40))
                            .foregroundStyle(.quaternary)
                        Text("No scheduled items")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding()
        }
    }

    // MARK: - This Week Panel

    private var thisWeekPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("This Week")
                .font(.headline)
                .padding(.horizontal)
                .padding(.top, 16)

            if thisWeekItems.isEmpty {
                VStack(spacing: 8) {
                    Spacer()
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 32))
                        .foregroundStyle(.green.opacity(0.5))
                    Text("Nothing scheduled")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(thisWeekItems) { item in
                            calendarItemRow(item)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 16)
                }
            }
        }
        .background(Color(red: 0.96, green: 0.95, blue: 0.98))
    }

    // MARK: - Shared Item Row

    private func calendarItemRow(_ item: WorkItem) -> some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3)
                .fill(colorForType(item.type))
                .frame(width: 4, height: 40)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.subject)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(clientName(for: item))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let date = item.scheduledDate {
                        Text(date.formatted(date: .abbreviated, time: .omitted))
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer()

            Text(item.type.displayName)
                .font(.caption2)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(colorForType(item.type).opacity(0.12))
                )
                .foregroundStyle(colorForType(item.type))
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
        )
    }

    // MARK: - Helpers

    private func colorForType(_ type: WorkItem.WorkItemType) -> Color {
        switch type {
        case .changeRequest: return Color(red: 0.486, green: 0.227, blue: 0.929)
        case .featureRequest: return Color.green
        case .maintenance: return Color.orange
        }
    }

    private func daysInMonth() -> [Date?] {
        guard let range = calendar.range(of: .day, in: .month, for: displayDate),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: displayDate))
        else { return [] }

        let weekdayOfFirst = calendar.component(.weekday, from: firstDay) - 1
        var days: [Date?] = Array(repeating: nil, count: weekdayOfFirst)

        for day in range {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: firstDay) {
                days.append(date)
            }
        }

        // Fill remaining cells to complete the grid
        let remainder = days.count % 7
        if remainder != 0 {
            days.append(contentsOf: Array(repeating: nil as Date?, count: 7 - remainder))
        }

        return days
    }
}

#Preview {
    CalendarView()
}
