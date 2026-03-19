import SwiftUI

enum SidebarItem: String, CaseIterable, Identifiable {
    case inbox = "Inbox"
    case workItems = "Work Items"
    case calendar = "Calendar"
    case clients = "Clients"
    case settings = "Settings"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .inbox: return "tray.fill"
        case .workItems: return "doc.text.fill"
        case .calendar: return "calendar"
        case .clients: return "person.2.fill"
        case .settings: return "gearshape.fill"
        }
    }
}

struct MainTabView: View {
    @Environment(FirestoreService.self) private var firestoreService
    @Environment(ThemeManager.self) private var themeManager
    @State private var selectedTab: SidebarItem = .inbox

    private var draftCount: Int {
        firestoreService.workItems.filter { $0.status == .draft }.count
    }

    var body: some View {
        #if os(macOS)
        macOSLayout
        #else
        iOSLayout
        #endif
    }

    // MARK: - macOS Layout

    #if os(macOS)
    private var macOSLayout: some View {
        NavigationSplitView {
            List(SidebarItem.allCases, selection: $selectedTab) { item in
                Label {
                    Text(item.rawValue)
                } icon: {
                    Image(systemName: item.icon)
                }
                .badge(item == .inbox ? draftCount : 0)
                .tag(item)
            }
            .navigationTitle("OpenChanges")
            .listStyle(.sidebar)
        } detail: {
            detailView(for: selectedTab)
        }
        .task {
            firestoreService.streamWorkItems()
            firestoreService.streamClients()
        }
    }
    #endif

    // MARK: - iOS Layout

    #if os(iOS)
    private var iOSLayout: some View {
        TabView(selection: $selectedTab) {
            Tab(SidebarItem.inbox.rawValue, systemImage: SidebarItem.inbox.icon, value: .inbox) {
                InboxView()
            }
            .badge(draftCount)

            Tab(SidebarItem.workItems.rawValue, systemImage: SidebarItem.workItems.icon, value: .workItems) {
                WorkItemsView()
            }

            Tab(SidebarItem.calendar.rawValue, systemImage: SidebarItem.calendar.icon, value: .calendar) {
                CalendarView()
            }

            Tab(SidebarItem.clients.rawValue, systemImage: SidebarItem.clients.icon, value: .clients) {
                ClientsView()
            }

            Tab(SidebarItem.settings.rawValue, systemImage: SidebarItem.settings.icon, value: .settings) {
                SettingsView()
            }
        }
        .task {
            firestoreService.streamWorkItems()
            firestoreService.streamClients()
        }
    }
    #endif

    // MARK: - Detail Views

    @ViewBuilder
    private func detailView(for item: SidebarItem) -> some View {
        switch item {
        case .inbox:
            InboxView()
        case .workItems:
            WorkItemsView()
        case .calendar:
            CalendarView()
        case .clients:
            ClientsView()
        case .settings:
            SettingsView()
        }
    }
}
