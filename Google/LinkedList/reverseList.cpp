#include<bits/stdc++.h>

using namespace std;

struct ListNode{
    int val;
    ListNode* next;
    ListNode(int x): val(x), next(nullptr){}
};

ListNode* reverseLinkedList( ListNode* head ){
    ListNode* prev = head;
    ListNode* curr = head;
    if( !head ){
        return nullptr;
    }
    if( !head->next ){
        return head;
    }
    curr = curr->next;
    while( curr ){
        ListNode* temp = curr;
        curr = curr->next;
        temp -> next = prev;
        prev = temp;
    }
    head -> next = nullptr;
    head = prev;
    return head;
}
