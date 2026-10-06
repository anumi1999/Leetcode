#include<bits/stdc++.h>

using namespace std;

struct ListNode{
    int val;
    ListNode* next;
    ListNode(int x): val(x), next(nullptr) {}
};

ListNode* middleNode(ListNode* head){
    ListNode* fast = head;
    ListNode* slow = head;
    while (fast && fast->next)
    {   
        slow = slow -> next;
        fast = fast -> next -> next;
    }
    return slow;
}