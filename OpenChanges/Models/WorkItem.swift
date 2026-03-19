import Foundation
import FirebaseFirestore

struct LineItem: Codable, Identifiable, Hashable, Sendable {
    var id: String = UUID().uuidString
    var description: String
    var hours: Double
    var cost: Double

    enum CodingKeys: String, CodingKey {
        case id
        case description
        case hours
        case cost
    }
}

struct WorkItem: Codable, Identifiable, Hashable, Sendable {
    @DocumentID var id: String?
    var type: WorkItemType
    var status: Status
    var clientId: String
    var projectId: String?
    var sourceEmail: String
    var subject: String
    var lineItems: [LineItem]
    var totalHours: Double
    var totalCost: Double
    var pdfUrl: String?
    var scheduledDate: Date?
    var createdAt: Date
    var updatedAt: Date

    enum WorkItemType: String, Codable, CaseIterable, Sendable {
        case changeRequest
        case featureRequest
        case maintenance

        var displayName: String {
            switch self {
            case .changeRequest: return "Change Request"
            case .featureRequest: return "Feature Request"
            case .maintenance: return "Maintenance"
            }
        }
    }

    enum Status: String, Codable, CaseIterable, Sendable {
        case draft
        case inReview
        case approved
        case completed

        var displayName: String {
            switch self {
            case .draft: return "Draft"
            case .inReview: return "In Review"
            case .approved: return "Approved"
            case .completed: return "Completed"
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case type
        case status
        case clientId
        case projectId
        case sourceEmail
        case subject
        case lineItems
        case totalHours
        case totalCost
        case pdfUrl
        case scheduledDate
        case createdAt
        case updatedAt
    }

    init(
        id: String? = nil,
        type: WorkItemType,
        status: Status = .draft,
        clientId: String,
        projectId: String? = nil,
        sourceEmail: String,
        subject: String,
        lineItems: [LineItem] = [],
        totalHours: Double = 0,
        totalCost: Double = 0,
        pdfUrl: String? = nil,
        scheduledDate: Date? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.type = type
        self.status = status
        self.clientId = clientId
        self.projectId = projectId
        self.sourceEmail = sourceEmail
        self.subject = subject
        self.lineItems = lineItems
        self.totalHours = totalHours
        self.totalCost = totalCost
        self.pdfUrl = pdfUrl
        self.scheduledDate = scheduledDate
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    /// Recalculates totals from line items.
    mutating func recalculateTotals() {
        totalHours = lineItems.reduce(0) { $0 + $1.hours }
        totalCost = lineItems.reduce(0) { $0 + $1.cost }
    }
}

extension WorkItem {
    func toFirestoreData() -> [String: Any] {
        var data: [String: Any] = [
            "type": type.rawValue,
            "status": status.rawValue,
            "clientId": clientId,
            "sourceEmail": sourceEmail,
            "subject": subject,
            "lineItems": lineItems.map { item in
                [
                    "id": item.id,
                    "description": item.description,
                    "hours": item.hours,
                    "cost": item.cost
                ] as [String: Any]
            },
            "totalHours": totalHours,
            "totalCost": totalCost,
            "createdAt": Timestamp(date: createdAt),
            "updatedAt": Timestamp(date: updatedAt)
        ]
        if let projectId { data["projectId"] = projectId }
        if let pdfUrl { data["pdfUrl"] = pdfUrl }
        if let scheduledDate { data["scheduledDate"] = Timestamp(date: scheduledDate) }
        return data
    }

    static func from(document: DocumentSnapshot) -> WorkItem? {
        try? document.data(as: WorkItem.self)
    }
}
