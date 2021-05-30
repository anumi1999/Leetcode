/*You are given a two-dimensional list of integers matrix which contains 1s and 0s. Given that each row is sorted in ascending order with 0s coming before 1s, return the leftmost column index with the value of 1. If there's no row with a 1, return -1.

Can you solve it faster than \mathcal{O}(nm)O(nm). */

int solve(vector<vector<int>>& matrix) {
    int n = matrix.size() ;
    if( n == 0){
        return -1;
    }
    int  m = matrix[0].size();
    int row = 0 , col = m -1;
    int flag = 0;
    while( row < n && col >= 0){
        if( matrix[row][col] == 1){
            col--;
            flag = 1;
        }
        else{
            row++;
        }
    }
    col++;
    if( flag ){
        return col;
    }
    return -1;

}
