import Foundation
import Observation
import FirebaseFirestore
import FirebaseFunctions

@Observable
final class FirestoreService {
    var workItems: [WorkItem] = []
    var clients: [Client] = []

    private let db = Firestore.firestore()
    private let functions = Functions.functions()
    private var workItemsListener: ListenerRegistration?
    private var clientsListener: ListenerRegistration?

    private var workItemsCollection: CollectionReference {
        db.collection("workItems")
    }

    private var clientsCollection: CollectionReference {
        db.collection("clients")
    }

    deinit {
        workItemsListener?.remove()
        clientsListener?.remove()
    }

    // MARK: - Work Items

    func fetchWorkItems(status: WorkItem.Status? = nil) async throws -> [WorkItem] {
        var query: Query = workItemsCollection.order(by: "createdAt", descending: true)

        if let status {
            query = query.whereField("status", isEqualTo: status.rawValue)
        }

        let snapshot = try await query.getDocuments()
        return snapshot.documents.compactMap { try? $0.data(as: WorkItem.self) }
    }

    func streamWorkItems() {
        workItemsListener?.remove()
        workItemsListener = workItemsCollection
            .order(by: "createdAt", descending: true)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self, let snapshot else {
                    if let error {
                        print("Error streaming work items: \(error.localizedDescription)")
                    }
                    return
                }
                self.workItems = snapshot.documents.compactMap {
                    try? $0.data(as: WorkItem.self)
                }
            }
    }

    func updateWorkItem(_ item: WorkItem) async throws {
        guard let id = item.id else { return }
        var updated = item
        updated.updatedAt = Date()
        try workItemsCollection.document(id).setData(from: updated, merge: true)
    }

    func fetchWorkItemsForDate(_ date: Date) -> [WorkItem] {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            return []
        }
        return workItems.filter { item in
            guard let scheduled = item.scheduledDate else { return false }
            return scheduled >= startOfDay && scheduled < endOfDay
        }
    }

    // MARK: - Clients

    func fetchClients() async throws -> [Client] {
        let snapshot = try await clientsCollection
            .order(by: "name")
            .getDocuments()
        return snapshot.documents.compactMap { try? $0.data(as: Client.self) }
    }

    func streamClients() {
        clientsListener?.remove()
        clientsListener = clientsCollection
            .order(by: "name")
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self, let snapshot else {
                    if let error {
                        print("Error streaming clients: \(error.localizedDescription)")
                    }
                    return
                }
                self.clients = snapshot.documents.compactMap {
                    try? $0.data(as: Client.self)
                }
            }
    }

    func createClient(_ client: Client) async throws {
        try clientsCollection.addDocument(from: client)
    }

    func updateClient(_ client: Client) async throws {
        guard let id = client.id else { return }
        try clientsCollection.document(id).setData(from: client, merge: true)
    }

    // MARK: - PDF Generation

    func generatePDF(workItemId: String) async throws -> URL {
        let result = try await functions.httpsCallable("generatePDF").call(["workItemId": workItemId])

        guard let data = result.data as? [String: Any],
              let urlString = data["pdfUrl"] as? String,
              let url = URL(string: urlString) else {
            throw FirestoreServiceError.invalidPDFResponse
        }

        return url
    }
}

enum FirestoreServiceError: LocalizedError {
    case invalidPDFResponse

    var errorDescription: String? {
        switch self {
        case .invalidPDFResponse:
            return "The PDF generation function returned an invalid response."
        }
    }
}
