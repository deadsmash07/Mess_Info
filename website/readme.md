commands for SQL;
- login to mysql by using the following command;
```bash
mysql -h sql.freedb.tech -u freedb_messinfo -p
```
- enter the password set by the admin.
- here are useful commands for SQL to see the database and tables;
```sql
SHOW DATABASES;
``` 
- Use a Specific Database:
```sql
USE your_database_name;
```
- Show All Tables in the Current Database
```sql
SHOW TABLES;
```
- Describe the Structure of a Table:
```sql
DESCRIBE table_name;
```
- Show All Columns and Data in a Table:
```sql
SELECT * FROM table_name;
```
- figure out how to use analytics and speedinfo of vercel as i have intalled their packages